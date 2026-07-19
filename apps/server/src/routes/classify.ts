/**
 * Classification + classifier settings routes. AGENTS.md §13 / M13
 */
import type { FastifyInstance } from "fastify";
import {
  ClassifierSettingsV1Schema,
  ErrorCode,
} from "@apptrack/shared";
import {
  CLASSIFIER_VERSION,
  PROMPT_VERSION,
  RULES_VERSION,
} from "@apptrack/core";
import { repos } from "@apptrack/db";
import { classifyAndStoreMessage } from "../services/email-classify-service.js";
import { resolveClassifierConfig } from "../services/classifier-config.js";

export async function registerClassifyRoutes(app: FastifyInstance) {
  app.get("/api/v1/classify/version", async () => ({
    classifierVersion: CLASSIFIER_VERSION,
    rulesVersion: RULES_VERSION,
    promptVersion: PROMPT_VERSION,
    modes: ["deterministic", "local", "api", "hybrid"],
  }));

  app.post("/api/v1/classify/:messageId", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { messageId } = req.params as { messageId: string };
    try {
      const out = await classifyAndStoreMessage(app.db, messageId, {
        userId: req.userId,
      });
      return {
        messageId: out.messageId,
        inserted: out.inserted,
        classifierVersion: out.classifierVersion,
        mode: out.mode,
        promptVersion: out.promptVersion,
        modelId: out.modelId,
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

  app.get("/api/v1/settings/classifier", async (req) => {
    // Works without DB for env-only disclosure (demo / first-run)
    let settings = null;
    const userId = req.userId ?? null;
    if (app.db) {
      if (userId) {
        const row = await repos.settingsRepo.getSettingsForUser(app.db, userId);
        settings = row?.classifierSettings
          ? ClassifierSettingsV1Schema.safeParse(row.classifierSettings).data
          : null;
      }
    }
    const config = resolveClassifierConfig(settings);
    return {
      userId,
      settings: {
        mode: config.mode,
        provider: config.provider,
        modelId: config.modelId,
      },
      keysPresent: {
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY),
        ollamaUrl: Boolean(process.env.OLLAMA_URL),
      },
      egressDisclosure: config.egressDisclosure,
      classifierVersion: CLASSIFIER_VERSION,
      promptVersion: PROMPT_VERSION,
    };
  });

  app.patch("/api/v1/settings/classifier", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const body = (req.body ?? {}) as {
      settings?: unknown;
    };
    const parsed = ClassifierSettingsV1Schema.safeParse(body.settings ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "invalid classifier settings",
          details: parsed.error.flatten(),
        },
      });
    }
    const row = await repos.settingsRepo.upsertClassifierSettings(
      app.db,
      req.userId!,
      parsed.data,
    );
    await repos.correctionsRepo.writeAuditLog(app.db, {
      userId: req.userId,
      actor: "user",
      action: "settings.classifier.update",
      targetType: "user_settings",
      targetId: row.id,
      metadata: { settings: parsed.data },
    });
    const config = resolveClassifierConfig(parsed.data);
    return {
      userId: req.userId,
      settings: parsed.data,
      egressDisclosure: config.egressDisclosure,
      classifierVersion: CLASSIFIER_VERSION,
    };
  });
}
