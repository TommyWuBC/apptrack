/**
 * Correlation + unique-link routes. AGENTS.md §21 / §22 / M16
 */
import type { FastifyInstance } from "fastify";
import {
  CorrelationFeedbackV1Schema,
  ErrorCode,
  JobName,
  MintLinkV1Schema,
} from "@apptrack/shared";
import { CORRELATION_VERSION } from "@apptrack/core";
import { repos } from "@apptrack/db";
import {
  correlationEnabled,
  runCorrelationScore,
} from "../services/correlation-score-service.js";
import {
  mintApplicationLink,
  revokeApplicationLink,
  serveTrackedResume,
} from "../services/links-service.js";

export async function registerCorrelationRoutes(app: FastifyInstance) {
  app.get("/api/v1/correlation/version", async () => ({
    algorithmVersion: CORRELATION_VERSION,
    enabled: correlationEnabled(),
  }));

  app.get("/api/v1/correlations", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    if (!correlationEnabled()) {
      return { enabled: false, predictions: [] };
    }
    const q = req.query as { applicationId?: string };
    if (!q.applicationId) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "applicationId required",
        },
      });
    }
    const application = await repos.applicationsRepo.getApplicationById(
      app.db,
      q.applicationId,
    );
    if (!application || application.userId !== req.userId) {
      return reply.code(404).send({
        error: { code: ErrorCode.NOT_FOUND, message: "application_not_found" },
      });
    }
    const predictions = await repos.correlationRepo.listPredictionsForApplication(
      app.db,
      q.applicationId,
    );
    const withFeatures = [];
    for (const prediction of predictions) {
      const features = await repos.correlationRepo.listFeaturesForPrediction(
        app.db,
        prediction.id,
      );
      withFeatures.push({ ...prediction, features });
    }
    return {
      enabled: true,
      algorithmVersion: CORRELATION_VERSION,
      predictions: withFeatures,
    };
  });

  app.post("/api/v1/correlations/:id/feedback", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const parsed = CorrelationFeedbackV1Schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "invalid feedback",
          details: parsed.error.flatten(),
        },
      });
    }
    const prediction = await repos.correlationRepo.getPredictionById(app.db, id);
    if (!prediction) {
      return reply.code(404).send({
        error: { code: ErrorCode.NOT_FOUND, message: "prediction_not_found" },
      });
    }
    const application = await repos.applicationsRepo.getApplicationById(
      app.db,
      prediction.applicationId,
    );
    if (!application || application.userId !== req.userId) {
      return reply.code(404).send({
        error: { code: ErrorCode.NOT_FOUND, message: "prediction_not_found" },
      });
    }
    const updated = await repos.correlationRepo.setPredictionFeedback(
      app.db,
      id,
      parsed.data.feedback,
    );
    await repos.correctionsRepo.writeAuditLog(app.db, {
      userId: req.userId,
      actor: "user",
      action: "correlation.feedback",
      targetType: "correlation_prediction",
      targetId: id,
      metadata: { feedback: parsed.data.feedback },
    });
    return { prediction: updated };
  });

  app.post("/api/v1/correlation/score", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const body = (req.body ?? {}) as {
      sessionIds?: string[];
      applicationId?: string;
    };
    if (app.jobs && !req.isInternalJob) {
      const jobId = await app.jobs.send(JobName.CORRELATION_SCORE, body, {
        singletonKey: `correlation.score:${body.applicationId ?? "batch"}:${Math.floor(Date.now() / 60_000)}`,
      });
      return reply.code(202).send({ queued: true, jobId });
    }
    const out = await runCorrelationScore(app.db, body);
    return out;
  });

  app.post("/api/v1/links", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const parsed = MintLinkV1Schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "invalid link request",
          details: parsed.error.flatten(),
        },
      });
    }
    try {
      const appBaseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
        /\/$/,
        "",
      );
      const link = await mintApplicationLink(app.db, {
        userId: req.userId!,
        applicationId: parsed.data.applicationId,
        appBaseUrl,
        portfolioBaseUrl: process.env.PORTFOLIO_BASE_URL,
      });
      return { link, enableResumeLink: parsed.data.enableResumeLink };
    } catch (err) {
      if ((err as { code?: string }).code === "NOT_FOUND") {
        return reply.code(404).send({
          error: { code: ErrorCode.NOT_FOUND, message: "application_not_found" },
        });
      }
      throw err;
    }
  });

  app.delete("/api/v1/links/:applicationId", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { applicationId } = req.params as { applicationId: string };
    try {
      const out = await revokeApplicationLink(app.db, req.userId!, applicationId);
      return out;
    } catch (err) {
      if ((err as { code?: string }).code === "NOT_FOUND") {
        return reply.code(404).send({
          error: { code: ErrorCode.NOT_FOUND, message: "application_not_found" },
        });
      }
      throw err;
    }
  });

  app.post("/api/v1/resume", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const body = req.body as {
      filename?: string;
      contentType?: string;
      /** Base64-encoded PDF (or other) bytes — small personal resume only. */
      contentBase64?: string;
    };
    if (!body?.contentBase64 || !body.filename) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "filename and contentBase64 required",
        },
      });
    }
    const bytes = Buffer.from(body.contentBase64, "base64");
    if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) {
      return reply.code(413).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "resume_too_large",
        },
      });
    }
    const row = await repos.resumesRepo.upsertResume(app.db, {
      userId: req.userId!,
      filename: body.filename.slice(0, 200),
      contentType: body.contentType ?? "application/pdf",
      bytes,
    });
    await repos.correctionsRepo.writeAuditLog(app.db, {
      userId: req.userId,
      actor: "user",
      action: "resume.upload",
      targetType: "user_resume",
      targetId: row.id,
      metadata: { filename: row.filename, bytes: bytes.length },
    });
    return {
      id: row.id,
      filename: row.filename,
      contentType: row.contentType,
      sizeBytes: bytes.length,
    };
  });

  app.get("/api/v1/resume", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const row = await repos.resumesRepo.getResumeForUser(app.db, req.userId!);
    if (!row) {
      return { resume: null };
    }
    return {
      resume: {
        id: row.id,
        filename: row.filename,
        contentType: row.contentType,
        sizeBytes: row.bytes.length,
        updatedAt: row.updatedAt,
      },
    };
  });

  // Public tracked résumé — no session. §20.5 / §22
  app.get("/r/:token/resume.pdf", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { token } = req.params as { token: string };
    const served = await serveTrackedResume(app.db, token);
    if (!served) {
      return reply.code(404).send({
        error: { code: ErrorCode.NOT_FOUND, message: "resume_not_found" },
      });
    }
    reply.header("content-type", served.contentType || "application/pdf");
    reply.header(
      "content-disposition",
      `inline; filename="${served.filename.replace(/"/g, "")}"`,
    );
    reply.header("cache-control", "private, no-store");
    return reply.send(served.bytes);
  });
}
