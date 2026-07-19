/**
 * Corrections, review resolve, merge/split/reattach. AGENTS.md §18 / §22 / M11
 */
import type { FastifyInstance } from "fastify";
import {
  ApplicationPatchV1Schema,
  ErrorCode,
  ReviewResolutionV1Schema,
} from "@apptrack/shared";
import { repos } from "@apptrack/db";
import {
  mergeApplications,
  mergeCompanies,
  patchApplication,
  reattachEvent,
  resolveReview,
  splitApplication,
  undoCorrection,
  type ReviewResolution,
} from "../services/corrections-service.js";

function mapErr(err: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  const msg = (err as Error).message;
  if (msg === "application_not_found" || msg.startsWith("application_not_found:")) {
    return reply.code(404).send({
      error: { code: ErrorCode.NOT_FOUND, message: msg },
    });
  }
  if (
    msg === "correction_not_found" ||
    msg === "event_not_found" ||
    msg === "review_not_found" ||
    msg === "company_not_found"
  ) {
    return reply.code(404).send({
      error: { code: ErrorCode.NOT_FOUND, message: msg },
    });
  }
  if (msg === "version_conflict" || (err as { code?: string }).code === "CONFLICT") {
    return reply.code(409).send({
      error: { code: ErrorCode.CONFLICT, message: msg },
    });
  }
  if (
    msg === "review_not_open" ||
    msg === "event_already_superseded" ||
    msg === "merge_user_mismatch" ||
    msg === "merge_same_company"
    || msg.startsWith("invalid_")
  ) {
    return reply.code(400).send({
      error: { code: ErrorCode.VALIDATION_ERROR, message: msg },
    });
  }
  throw err;
}

export async function registerCorrectionsRoutes(app: FastifyInstance) {
  app.patch("/api/v1/applications/:id", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const parsed = ApplicationPatchV1Schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "invalid_application_patch",
          details: parsed.error.flatten(),
        },
      });
    }
    try {
      return await patchApplication(app.db, id, {
        fields: parsed.data.fields.map((field) => ({
          field: field.field,
          userValue: field.userValue,
          locked: field.locked,
        })),
        expectedVersion: parsed.data.expectedVersion,
        userId: req.userId,
      });
    } catch (err) {
      return mapErr(err, reply);
    }
  });

  app.post("/api/v1/applications/:id/merge", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const body = req.body as { sourceIds: string[] };
    try {
      return await mergeApplications(
        app.db,
        id,
        body.sourceIds ?? [],
        req.userId,
      );
    } catch (err) {
      return mapErr(err, reply);
    }
  });

  app.post("/api/v1/applications/:id/split", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const body = req.body as {
      eventIds: string[];
      roleId?: string;
    };
    try {
      return await splitApplication(app.db, id, body.eventIds ?? [], {
        userId: req.userId,
        roleId: body.roleId,
      });
    } catch (err) {
      return mapErr(err, reply);
    }
  });

  app.post(
    "/api/v1/applications/:id/events/:eventId/reattach",
    async (req, reply) => {
      if (!app.db) {
        return reply.code(503).send({
          error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
        });
      }
      const { eventId } = req.params as { id: string; eventId: string };
      const body = req.body as { toApplicationId: string };
      try {
        return await reattachEvent(
          app.db,
          eventId,
          body.toApplicationId,
          req.userId,
        );
      } catch (err) {
        return mapErr(err, reply);
      }
    },
  );

  app.post("/api/v1/corrections/:id/undo", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    try {
      return await undoCorrection(app.db, id, req.userId);
    } catch (err) {
      return mapErr(err, reply);
    }
  });

  app.get("/api/v1/applications/:id/corrections", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const corrections = await repos.correctionsRepo.listCorrectionsForTarget(
      app.db,
      "application",
      id,
    );
    return { applicationId: id, corrections };
  });

  app.post("/api/v1/review/:id/resolve", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const parsed = ReviewResolutionV1Schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "invalid_review_resolution",
          details: parsed.error.flatten(),
        },
      });
    }
    try {
      return await resolveReview(
        app.db,
        id,
        parsed.data as ReviewResolution,
        req.userId,
      );
    } catch (err) {
      return mapErr(err, reply);
    }
  });

  app.post("/api/v1/companies/merge", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const body = req.body as {
      survivorCompanyId: string;
      sourceCompanyId: string;
    };
    try {
      return await mergeCompanies(
        app.db,
        body.survivorCompanyId,
        body.sourceCompanyId,
        req.userId,
      );
    } catch (err) {
      return mapErr(err, reply);
    }
  });
}
