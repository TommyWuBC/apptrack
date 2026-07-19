/**
 * Corrections, review resolve, merge/split/reattach. AGENTS.md §18 / §22 / M11
 */
import type { FastifyInstance } from "fastify";
import { ErrorCode } from "@apptrack/shared";
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
    const body = req.body as {
      fields?: Array<{ field: string; userValue: unknown; locked?: boolean }>;
      expectedVersion?: string;
      userId?: string;
    };
    try {
      return await patchApplication(app.db, id, body ?? {});
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
    const body = req.body as { sourceIds: string[]; userId?: string };
    try {
      return await mergeApplications(
        app.db,
        id,
        body.sourceIds ?? [],
        body.userId,
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
      userId?: string;
      roleId?: string;
    };
    try {
      return await splitApplication(app.db, id, body.eventIds ?? [], {
        userId: body.userId,
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
      const body = req.body as { toApplicationId: string; userId?: string };
      try {
        return await reattachEvent(
          app.db,
          eventId,
          body.toApplicationId,
          body.userId,
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
    const body = (req.body as { userId?: string }) ?? {};
    try {
      return await undoCorrection(app.db, id, body.userId);
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
    const body = req.body as ReviewResolution & { userId?: string };
    try {
      const { userId, ...resolution } = body;
      return await resolveReview(app.db, id, resolution, userId);
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
      userId?: string;
    };
    try {
      return await mergeCompanies(
        app.db,
        body.survivorCompanyId,
        body.sourceCompanyId,
        body.userId,
      );
    } catch (err) {
      return mapErr(err, reply);
    }
  });
}
