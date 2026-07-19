import type { FastifyInstance } from "fastify";
import { EmailReprocessJobV1Schema, JobName } from "@apptrack/shared/jobs";
import { ErrorCode } from "@apptrack/shared";
import { runEmailReprocess } from "../services/email-reprocess-service.js";

function singletonKey(input: unknown): string {
  return `email.reprocess:${Buffer.from(JSON.stringify(input)).toString("base64url").slice(0, 120)}`;
}

export async function registerReprocessRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/reprocess", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const parsed = EmailReprocessJobV1Schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "invalid_reprocess_scope",
          details: parsed.error.flatten(),
        },
      });
    }
    if (app.jobs) {
      const jobId = await app.jobs.send(JobName.EMAIL_REPROCESS, parsed.data, {
        singletonKey: singletonKey(parsed.data),
      });
      return reply.code(202).send({ queued: true, jobId });
    }
    return runEmailReprocess(app.db, parsed.data);
  });

  app.post("/api/v1/reprocess/execute", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const parsed = EmailReprocessJobV1Schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "invalid_reprocess_scope",
          details: parsed.error.flatten(),
        },
      });
    }
    return runEmailReprocess(app.db, parsed.data);
  });
}
