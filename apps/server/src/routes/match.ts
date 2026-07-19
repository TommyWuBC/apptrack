/**
 * Application matching routes. AGENTS.md §15 / §22 / M8
 */
import type { FastifyInstance } from "fastify";
import { ErrorCode, JobName } from "@apptrack/shared";
import { MATCHER_VERSION } from "@apptrack/core";
import {
  matchAndStoreMessage,
  reevaluateMatchesForCompany,
} from "../services/application-match-service.js";
import { repos } from "@apptrack/db";

export async function registerMatchRoutes(app: FastifyInstance) {
  app.get("/api/v1/match/version", async () => ({
    matcherVersion: MATCHER_VERSION,
  }));

  // Static paths before :messageId param routes
  app.post("/api/v1/match/reevaluate/:companyId", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { companyId } = req.params as { companyId: string };
    if (app.jobs && !req.isInternalJob) {
      const date = new Date().toISOString().slice(0, 10);
      const jobId = await app.jobs.send(
        JobName.MATCH_REEVALUATE,
        { companyId },
        { singletonKey: `match.reevaluate:${companyId}:${date}` },
      );
      return reply.code(202).send({ queued: true, jobId, companyId });
    }
    const out = await reevaluateMatchesForCompany(app.db, companyId);
    return { companyId, ...out, matcherVersion: MATCHER_VERSION };
  });

  app.get("/api/v1/review", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const q = req.query as { kind?: string };
    const items = await repos.matchingRepo.listOpenReviewItems(app.db, {
      kind: q.kind,
    });
    return { items };
  });

  app.post("/api/v1/match/:messageId", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { messageId } = req.params as { messageId: string };
    if (app.jobs && !req.isInternalJob) {
      const jobId = await app.jobs.send(
        JobName.APPLICATION_MATCH,
        { messageId },
        { singletonKey: `application.match:${messageId}` },
      );
      return reply.code(202).send({ queued: true, jobId, messageId });
    }
    try {
      const out = await matchAndStoreMessage(app.db, messageId);
      return {
        messageId: out.messageId,
        skipped: out.skipped,
        skipReason: out.skipReason,
        matcherVersion: MATCHER_VERSION,
        decision: out.match?.decision ?? null,
        score: out.match?.score ?? null,
        margin: out.match?.margin ?? null,
        reason: out.match?.reason ?? null,
        applicationId: out.applicationId,
        reviewItemId: out.reviewItemId,
        companyId: out.companyId,
        candidates: out.match?.candidates ?? [],
      };
    } catch (err) {
      if ((err as Error).message === "message_not_found") {
        return reply.code(404).send({
          error: { code: ErrorCode.NOT_FOUND, message: "message_not_found" },
        });
      }
      throw err;
    }
  });

  app.get("/api/v1/match/:messageId/candidates", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { messageId } = req.params as { messageId: string };
    const rows = await repos.matchingRepo.listMatchCandidatesForMessage(
      app.db,
      messageId,
    );
    return { messageId, candidates: rows };
  });
}
