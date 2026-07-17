/**
 * Classification routes. AGENTS.md M7
 */
import type { FastifyInstance } from "fastify";
import { ErrorCode } from "@apptrack/shared";
import { CLASSIFIER_VERSION } from "@apptrack/core";
import { classifyAndStoreMessage } from "../services/email-classify-service.js";

export async function registerClassifyRoutes(app: FastifyInstance) {
  app.get("/api/v1/classify/version", async () => ({
    classifierVersion: CLASSIFIER_VERSION,
  }));

  app.post("/api/v1/classify/:messageId", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { messageId } = req.params as { messageId: string };
    try {
      const out = await classifyAndStoreMessage(app.db, messageId);
      return {
        messageId: out.messageId,
        inserted: out.inserted,
        classifierVersion: out.classifierVersion,
        eventType: out.result.eventType,
        confidence: out.result.confidence,
        needsReview: out.result.needsReview,
        evidence: out.result.evidence,
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
}
