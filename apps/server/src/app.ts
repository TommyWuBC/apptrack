import Fastify from "fastify";
import { coreHealth } from "@apptrack/core";
import { createDb, closeDb, dbHealth, type Database } from "@apptrack/db";
import {
  loadAuthConfig,
  loadServerConfig,
  type AuthConfig,
  type ServerConfig,
} from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerHelloRoutes } from "./routes/hello.js";
import { registerGmailRoutes } from "./routes/gmail.js";
import { registerSyncRoutes } from "./routes/sync.js";
import { registerNormalizeRoutes } from "./routes/normalize.js";
import { registerClassifyRoutes } from "./routes/classify.js";
import { registerMatchRoutes } from "./routes/match.js";
import { registerApplicationRoutes } from "./routes/applications.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerCorrectionsRoutes } from "./routes/corrections.js";
import { registerGhostRoutes } from "./routes/ghost.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerSdkRoutes } from "./routes/sdk.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerReprocessRoutes } from "./routes/reprocess.js";
import { registerCorrelationRoutes } from "./routes/correlation.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { registerSecurityHeadersPlugin } from "./plugins/security-headers.js";
import { registerApiRateLimitPlugin } from "./plugins/rate-limit-hook.js";
import { LOG_REDACT_PATHS } from "./plugins/logger-redact.js";
import { createJobQueue, type AppJobQueue } from "./jobs/queue.js";
import { openGeoLite2Lookup } from "./services/maxmind-geo.js";
import type { GeoLookup } from "./services/geo-lookup.js";

export type AppDb = Database | null;

export async function buildApp(
  opts: {
    logger?: boolean;
    databaseUrl?: string;
    /** Inject config (tests). If omitted, loaded from env when keys present. */
    config?: ServerConfig | null;
    authConfig?: AuthConfig;
  } = {},
) {
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            level: process.env.LOG_LEVEL ?? "info",
            redact: {
              paths: [...LOG_REDACT_PATHS],
              remove: true,
            },
          },
  });

  const url = opts.databaseUrl ?? process.env.DATABASE_URL;
  let db: AppDb = null;
  let jobs: AppJobQueue | null = null;
  let closeGeo: (() => void) | null = null;
  if (url) {
    try {
      db = createDb(url);
      await db.$client`select 1`;
      app.decorate("db", db);
    } catch (err) {
      app.log.warn({ err }, "DATABASE_URL set but connection failed");
      db = null;
    }
  }

  if (process.env.GEOLITE2_DB_PATH) {
    try {
      const geo = await openGeoLite2Lookup(process.env.GEOLITE2_DB_PATH);
      app.decorate("geoLookup", geo.lookup);
      closeGeo = geo.close;
    } catch (err) {
      app.log.warn({ err }, "GeoLite2 database unavailable; using CDN country only");
    }
  }

  if (db && url && process.env.JOBS_MODE !== "http") {
    try {
      jobs = await createJobQueue(url, (error) => {
        app.log.error({ err: error }, "pg-boss error");
      });
      app.decorate("jobs", jobs);
    } catch (err) {
      app.log.error({ err }, "pg-boss startup failed");
      jobs = null;
    }
  }

  const authConfig = opts.authConfig ?? loadAuthConfig();
  await registerSecurityHeadersPlugin(app);
  await registerApiRateLimitPlugin(app);
  await registerAuthPlugin(app, authConfig);
  await registerHealthRoutes(
    app,
    () => db !== null,
    () => jobs !== null || process.env.JOBS_MODE === "http",
  );
  await registerHelloRoutes(app);
  await registerAuthRoutes(app, authConfig);

  const config: ServerConfig | null =
    opts.config === undefined
      ? (() => {
          try {
            if (
              process.env.APP_ENCRYPTION_KEY &&
              process.env.GOOGLE_CLIENT_ID &&
              process.env.GOOGLE_CLIENT_SECRET
            ) {
              return loadServerConfig();
            }
          } catch (err) {
            app.log.warn({ err }, "gmail oauth config incomplete");
          }
          return null;
        })()
      : opts.config;

  if (config) {
    await registerGmailRoutes(app, config);
  }

  // Sync works with mock provider even without Google OAuth config.
  await registerSyncRoutes(app, config);
  await registerNormalizeRoutes(app);
  await registerClassifyRoutes(app);
  await registerMatchRoutes(app);
  await registerApplicationRoutes(app);
  await registerDashboardRoutes(app);
  await registerCorrectionsRoutes(app);
  await registerGhostRoutes(app);
  await registerAnalyticsRoutes(app);
  await registerReprocessRoutes(app);
  await registerCorrelationRoutes(app);
  await registerSdkRoutes(app);

  app.get("/api/v1/core-ping", async () => coreHealth());
  app.get("/api/v1/db-ping", async () => dbHealth(db ?? undefined));

  app.addHook("onClose", async () => {
    closeGeo?.();
    if (jobs) await jobs.stop();
    if (db) await closeDb(db);
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    db?: Database;
    jobs?: AppJobQueue;
    geoLookup?: GeoLookup;
  }
}
