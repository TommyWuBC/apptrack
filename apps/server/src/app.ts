import Fastify from "fastify";
import { coreHealth } from "@apptrack/core";
import { createDb, closeDb, dbHealth, type Database } from "@apptrack/db";
import { loadServerConfig, type ServerConfig } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerHelloRoutes } from "./routes/hello.js";
import { registerGmailRoutes } from "./routes/gmail.js";
import { registerSyncRoutes } from "./routes/sync.js";
import { registerNormalizeRoutes } from "./routes/normalize.js";
import { registerClassifyRoutes } from "./routes/classify.js";
import { registerMatchRoutes } from "./routes/match.js";
import { registerApplicationRoutes } from "./routes/applications.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";

export type AppDb = Database | null;

export async function buildApp(
  opts: {
    logger?: boolean;
    databaseUrl?: string;
    /** Inject config (tests). If omitted, loaded from env when keys present. */
    config?: ServerConfig | null;
  } = {},
) {
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            level: process.env.LOG_LEVEL ?? "info",
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "*.password",
                "*.refreshToken",
                "*.accessToken",
                "*.encrypted_refresh_token",
                "*.encrypted_access_token",
                "req.query.code",
              ],
              remove: true,
            },
          },
  });

  const url = opts.databaseUrl ?? process.env.DATABASE_URL;
  let db: AppDb = null;
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

  await registerHealthRoutes(app, () => db !== null);
  await registerHelloRoutes(app);

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

  app.get("/api/v1/core-ping", async () => coreHealth());
  app.get("/api/v1/db-ping", async () => dbHealth(db ?? undefined));

  app.addHook("onClose", async () => {
    if (db) await closeDb(db);
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    db?: Database;
  }
}
