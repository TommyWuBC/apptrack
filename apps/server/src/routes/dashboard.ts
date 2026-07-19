/**
 * Stats + companies + email evidence routes. AGENTS.md §19 / §22 / M10
 */
import type { FastifyInstance } from "fastify";
import { ErrorCode } from "@apptrack/shared";
import { repos } from "@apptrack/db";
import { computeStats, formatRateStat } from "../services/stats-service.js";

async function findSoleOwnerId(db: NonNullable<FastifyInstance["db"]>) {
  const user = await repos.usersRepo.getFirstUser(db);
  return user?.id ?? null;
}

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/api/v1/me", async (_req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const owner = await findSoleOwnerId(app.db);
    if (!owner) {
      return { userId: null, setupRequired: true };
    }
    return { userId: owner, setupRequired: false };
  });

  app.get("/api/v1/stats", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const q = req.query as { userId?: string };
    let userId = q.userId;
    if (!userId) {
      const owner = await findSoleOwnerId(app.db);
      if (!owner) {
        return reply.code(400).send({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "userId query param required",
          },
        });
      }
      userId = owner;
    }
    const stats = await computeStats(app.db, userId);
    return {
      ...stats,
      ratesFormatted: Object.fromEntries(
        Object.entries(stats.rates).map(([k, v]) => [k, formatRateStat(v)]),
      ),
    };
  });

  app.get("/api/v1/companies", async (_req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const companies = await repos.applicationsRepo.listCompanies(app.db);
    return { companies };
  });

  app.get("/api/v1/emails/:id/evidence", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const msg = await repos.emailsRepo.getEmailMessageById(app.db, id);
    if (!msg) {
      return reply.code(404).send({
        error: { code: ErrorCode.NOT_FOUND, message: "message_not_found" },
      });
    }
    const norm = await repos.normalizedEmailsRepo.getLatestNormalized(
      app.db,
      id,
    );
    const classification =
      await repos.classificationRepo.getLatestClassification(app.db, id);
    const candidates =
      await repos.matchingRepo.listMatchCandidatesForMessage(app.db, id);

    return {
      messageId: id,
      subject: msg.subject,
      fromAddress: msg.fromAddress,
      fromName: msg.fromName,
      internalDate: msg.internalDate,
      /** Sanitized HTML for sandboxed iframe (T4). */
      sanitizedHtml: norm?.sanitizedHtml ?? null,
      textPlain: norm?.textPlain ?? msg.snippet ?? null,
      classification: classification
        ? {
            eventType: classification.eventType,
            confidence: classification.confidence,
            evidence: classification.evidence,
            needsReview: classification.needsReview,
            extraction: classification.extraction,
            layerTrace: classification.layerTrace,
          }
        : null,
      matchCandidates: candidates.map((c) => ({
        id: c.id,
        applicationId: c.applicationId,
        score: c.score,
        decision: c.decision,
        signals: c.signals,
        matcherVersion: c.matcherVersion,
      })),
    };
  });
}
