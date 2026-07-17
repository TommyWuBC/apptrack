/**
 * Normalize routes. AGENTS.md M6
 */
import type { FastifyInstance } from "fastify";
import { ErrorCode } from "@apptrack/shared";
import { NORMALIZER_VERSION } from "@apptrack/core";
import { runNormalizeMessage } from "../services/email-normalize-service.js";

export async function registerNormalizeRoutes(app: FastifyInstance) {
  app.get("/api/v1/normalize/version", async () => ({
    normalizerVersion: NORMALIZER_VERSION,
  }));

  app.post("/api/v1/normalize/:messageId", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { messageId } = req.params as { messageId: string };
    try {
      const result = await runNormalizeMessage(app.db, messageId);
      return {
        messageId: result.messageId,
        inserted: result.inserted,
        normalizerVersion: result.normalizerVersion,
        textPlainPreview: result.normalized.textPlain.slice(0, 200),
        linkCount: result.normalized.links.length,
        hasCalendar: Boolean(result.normalized.calendarEvent),
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
