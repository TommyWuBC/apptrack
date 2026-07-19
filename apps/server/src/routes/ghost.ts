/**
 * Ghost evaluate, dismiss, settings, notifications. AGENTS.md §17 / §22 / M12
 */
import type { FastifyInstance } from "fastify";
import { ErrorCode, GhostThresholdsV1Schema, JobName } from "@apptrack/shared";
import { DEFAULT_GHOST_THRESHOLDS, GHOST_VERSION } from "@apptrack/core";
import { repos } from "@apptrack/db";
import {
  dismissGhost,
  evaluateApplicationGhost,
  evaluateGhostsForUser,
} from "../services/ghost-evaluate-service.js";

async function firstUserId(db: NonNullable<FastifyInstance["db"]>) {
  const owner = await repos.usersRepo.getFirstUser(db);
  return owner?.id ?? null;
}

export async function registerGhostRoutes(app: FastifyInstance) {
  app.get("/api/v1/ghost/version", async () => ({
    algorithmVersion: GHOST_VERSION,
    defaults: DEFAULT_GHOST_THRESHOLDS,
  }));

  app.post("/api/v1/ghost/evaluate", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const body = (req.body ?? {}) as { now?: string };
    if (app.jobs && !req.isInternalJob) {
      const date = (body.now ? new Date(body.now) : new Date())
        .toISOString()
        .slice(0, 10);
      const jobId = await app.jobs.send(
        JobName.GHOST_EVALUATE,
        { scheduledAt: body.now },
        { singletonKey: `ghost.evaluate:${date}` },
      );
      return reply.code(202).send({ queued: true, jobId });
    }
    const userId = req.userId ?? (await firstUserId(app.db));
    if (!userId) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "userId required (or create owner first)",
        },
      });
    }
    const now = body.now ? new Date(body.now) : undefined;
    const result = await evaluateGhostsForUser(app.db, userId, { now });
    return result;
  });

  app.post("/api/v1/ghost/evaluate/:applicationId", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { applicationId } = req.params as { applicationId: string };
    const body = (req.body ?? {}) as { now?: string; apply?: boolean };
    try {
      const out = await evaluateApplicationGhost(app.db, applicationId, {
        now: body.now ? new Date(body.now) : undefined,
        apply: body.apply !== false,
      });
      return out;
    } catch (err) {
      if ((err as Error).message === "application_not_found") {
        return reply.code(404).send({
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "application_not_found",
          },
        });
      }
      throw err;
    }
  });

  app.post("/api/v1/applications/:id/ghost/dismiss", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    try {
      return await dismissGhost(app.db, id, { userId: req.userId });
    } catch (err) {
      if ((err as Error).message === "application_not_found") {
        return reply.code(404).send({
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "application_not_found",
          },
        });
      }
      throw err;
    }
  });

  app.get("/api/v1/settings/ghost", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const userId = req.userId!;
    const row = await repos.settingsRepo.getSettingsForUser(app.db, userId);
    const parsed = GhostThresholdsV1Schema.parse(row?.ghostThresholds ?? {});
    return {
      userId,
      thresholds: { ...DEFAULT_GHOST_THRESHOLDS, ...parsed },
      algorithmVersion: GHOST_VERSION,
    };
  });

  app.patch("/api/v1/settings/ghost", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const body = (req.body ?? {}) as {
      thresholds?: unknown;
    };
    const parsed = GhostThresholdsV1Schema.safeParse(body.thresholds ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "invalid ghost thresholds",
          details: parsed.error.flatten(),
        },
      });
    }
    const row = await repos.settingsRepo.upsertGhostThresholds(
      app.db,
      req.userId!,
      parsed.data,
    );
    await repos.correctionsRepo.writeAuditLog(app.db, {
      userId: req.userId,
      actor: "user",
      action: "settings.ghost.update",
      targetType: "user_settings",
      targetId: row.id,
      metadata: { thresholds: parsed.data },
    });
    return {
      userId: req.userId,
      thresholds: parsed.data,
      algorithmVersion: GHOST_VERSION,
    };
  });

  app.get("/api/v1/notifications", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const q = req.query as { unreadOnly?: string };
    const notifications = await repos.notificationsRepo.listNotificationsForUser(
      app.db,
      req.userId!,
      { unreadOnly: q.unreadOnly === "1" || q.unreadOnly === "true" },
    );
    return { notifications, userId: req.userId };
  });

  app.post("/api/v1/notifications/:id/read", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const row = await repos.notificationsRepo.markNotificationRead(app.db, id);
    if (!row) {
      return reply.code(404).send({
        error: {
          code: ErrorCode.NOT_FOUND,
          message: "notification_not_found",
        },
      });
    }
    return { notification: row };
  });
}
