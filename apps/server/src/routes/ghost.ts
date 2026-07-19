/**
 * Ghost evaluate, dismiss, settings, notifications. AGENTS.md §17 / §22 / M12
 */
import type { FastifyInstance } from "fastify";
import { ErrorCode, GhostThresholdsV1Schema } from "@apptrack/shared";
import { DEFAULT_GHOST_THRESHOLDS, GHOST_VERSION } from "@apptrack/core";
import { repos } from "@apptrack/db";
import {
  dismissGhost,
  evaluateApplicationGhost,
  evaluateGhostsForUser,
} from "../services/ghost-evaluate-service.js";

async function resolveUserId(
  db: NonNullable<FastifyInstance["db"]>,
  qUserId?: string,
): Promise<string | null> {
  if (qUserId) return qUserId;
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
    const body = (req.body ?? {}) as { userId?: string; now?: string };
    const userId = await resolveUserId(app.db, body.userId);
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
    const body = (req.body ?? {}) as { userId?: string };
    try {
      return await dismissGhost(app.db, id, { userId: body.userId });
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
    const q = req.query as { userId?: string };
    const userId = await resolveUserId(app.db, q.userId);
    if (!userId) {
      return {
        userId: null,
        thresholds: DEFAULT_GHOST_THRESHOLDS,
        algorithmVersion: GHOST_VERSION,
      };
    }
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
      userId?: string;
      thresholds?: unknown;
    };
    const userId = await resolveUserId(app.db, body.userId);
    if (!userId) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "userId required",
        },
      });
    }
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
      userId,
      parsed.data,
    );
    await repos.correctionsRepo.writeAuditLog(app.db, {
      userId,
      actor: "user",
      action: "settings.ghost.update",
      targetType: "user_settings",
      targetId: row.id,
      metadata: { thresholds: parsed.data },
    });
    return {
      userId,
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
    const q = req.query as { userId?: string; unreadOnly?: string };
    const userId = await resolveUserId(app.db, q.userId);
    if (!userId) {
      return { notifications: [], userId: null };
    }
    const notifications = await repos.notificationsRepo.listNotificationsForUser(
      app.db,
      userId,
      { unreadOnly: q.unreadOnly === "1" || q.unreadOnly === "true" },
    );
    return { notifications, userId };
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
