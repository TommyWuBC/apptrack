/**
 * Analytics sites + public ingest. AGENTS.md §20 / §22 / M14
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  AnalyticsSiteCreateV1Schema,
  AnalyticsSiteUpdateV1Schema,
  ErrorCode,
} from "@apptrack/shared";
import { repos } from "@apptrack/db";
import {
  aggregateAnalyticsSessions,
  ingestAnalyticsBatch,
  MAX_BODY_BYTES,
  runAnalyticsRetention,
} from "../services/analytics-ingest-service.js";

function clientIp(req: FastifyRequest): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0]!.trim();
  }
  return req.ip || "0.0.0.0";
}

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  // Public ingest — no session cookie. CORS checked against site allowlist.
  app.options("/api/v1/analytics/events", async (req, reply) => {
    const origin = req.headers.origin;
    if (origin) {
      reply.header("access-control-allow-origin", origin);
      reply.header("vary", "Origin");
    }
    reply.header("access-control-allow-methods", "POST, OPTIONS");
    reply.header("access-control-allow-headers", "content-type");
    return reply.code(204).send();
  });

  app.post("/api/v1/analytics/events", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }

    const bodyBytes = Buffer.byteLength(JSON.stringify(req.body ?? {}));

    if (bodyBytes > MAX_BODY_BYTES) {
      return reply.code(413).send({
        error: { code: ErrorCode.VALIDATION_ERROR, message: "payload_too_large" },
      });
    }

    try {
      const out = await ingestAnalyticsBatch(app.db, req.body, {
        ip: clientIp(req),
        userAgent: req.headers["user-agent"],
        origin: req.headers.origin,
        headers: req.headers as Record<string, string | string[] | undefined>,
        bodyBytes,
      });
      const origin = req.headers.origin;
      if (origin) {
        reply.header("access-control-allow-origin", origin);
        reply.header("vary", "Origin");
      }
      return reply.code(202).send(out);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      const msg = (err as Error).message;
      if (status === 429) {
        return reply.code(429).send({
          error: { code: ErrorCode.RATE_LIMITED, message: msg },
        });
      }
      if (status === 401 || status === 403) {
        return reply.code(status).send({
          error: { code: ErrorCode.FORBIDDEN, message: msg },
        });
      }
      if (status === 400 || status === 413) {
        return reply.code(status).send({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: msg,
            details: (err as { details?: unknown }).details,
          },
        });
      }
      throw err;
    }
  });

  app.get("/api/v1/analytics/sites", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const sites = await repos.analyticsRepo.listSitesForUser(
      app.db,
      req.userId!,
    );
    return { sites, userId: req.userId };
  });

  app.post("/api/v1/analytics/sites", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const body = (req.body ?? {}) as {
      originAllowlist?: string[];
      mode?: string;
    };
    const parsed = AnalyticsSiteCreateV1Schema.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "invalid site",
          details: parsed.error.flatten(),
        },
      });
    }
    const site = await repos.analyticsRepo.createSite(app.db, {
      userId: req.userId!,
      originAllowlist: parsed.data.originAllowlist,
      mode: parsed.data.mode,
    });
    await repos.correctionsRepo.writeAuditLog(app.db, {
      userId: req.userId,
      actor: "user",
      action: "analytics.site.create",
      targetType: "analytics_site",
      targetId: site.id,
      metadata: { siteKey: site.siteKey, mode: site.mode },
    });
    return { site };
  });

  app.patch("/api/v1/analytics/sites/:id", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = AnalyticsSiteUpdateV1Schema.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "invalid site update",
          details: parsed.error.flatten(),
        },
      });
    }
    const site = await repos.analyticsRepo.updateSite(app.db, id, parsed.data);
    if (!site) {
      return reply.code(404).send({
        error: { code: ErrorCode.NOT_FOUND, message: "site_not_found" },
      });
    }
    return { site };
  });

  app.delete("/api/v1/analytics/sites/:id", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const site = await repos.analyticsRepo.deleteSite(app.db, id);
    if (!site) {
      return reply.code(404).send({
        error: { code: ErrorCode.NOT_FOUND, message: "site_not_found" },
      });
    }
    return { deleted: true, id };
  });

  app.get("/api/v1/analytics/sessions", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const q = req.query as { siteId?: string };
    if (!q.siteId) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "siteId required",
        },
      });
    }
    const sessions = await repos.analyticsRepo.listSessionsForSite(
      app.db,
      q.siteId,
    );
    return { sessions };
  });

  app.get("/api/v1/analytics/summary", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const q = req.query as { siteId?: string };
    if (!q.siteId) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "siteId required",
        },
      });
    }
    const summary = await repos.analyticsRepo.summarizeSite(app.db, q.siteId);
    return { siteId: q.siteId, ...summary };
  });

  app.post("/api/v1/analytics/aggregate", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const out = await aggregateAnalyticsSessions(app.db);
    return out;
  });

  app.post("/api/v1/analytics/retention", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const body = (req.body ?? {}) as { retentionDays?: number };
    const out = await runAnalyticsRetention(app.db, {
      retentionDays: body.retentionDays,
    });
    return out;
  });
}
