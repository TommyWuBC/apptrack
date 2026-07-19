/**
 * Applications + timeline API. AGENTS.md §16 / §22 / M9
 */
import type { FastifyInstance } from "fastify";
import { ErrorCode } from "@apptrack/shared";
import { REDUCER_VERSION } from "@apptrack/core";
import { repos } from "@apptrack/db";
import {
  getApplicationTimeline,
  recomputeApplication,
} from "../services/application-recompute-service.js";

export async function registerApplicationRoutes(app: FastifyInstance) {
  app.get("/api/v1/applications/reducer-version", async () => ({
    reducerVersion: REDUCER_VERSION,
  }));

  app.get("/api/v1/applications", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const q = req.query as { userId?: string };
    let userId = q.userId;
    if (!userId) {
      const owner = await repos.usersRepo.getFirstUser(app.db);
      if (!owner) {
        return reply.code(400).send({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "userId query param required",
          },
        });
      }
      userId = owner.id;
    }
    const applications =
      await repos.applicationsRepo.listApplicationsWithCompany(
        app.db,
        userId,
      );
    return { applications, userId };
  });

  app.get("/api/v1/applications/:id", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const application = await repos.applicationsRepo.getApplicationById(
      app.db,
      id,
    );
    if (!application) {
      return reply.code(404).send({
        error: { code: ErrorCode.NOT_FOUND, message: "application_not_found" },
      });
    }
    const company = await repos.applicationsRepo.getCompanyById(
      app.db,
      application.companyId,
    );
    return {
      application,
      company,
      reducerVersion: application.stateVersion ?? REDUCER_VERSION,
    };
  });

  app.get("/api/v1/applications/:id/timeline", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    const timeline = await getApplicationTimeline(app.db, id);
    if (!timeline) {
      return reply.code(404).send({
        error: { code: ErrorCode.NOT_FOUND, message: "application_not_found" },
      });
    }
    return timeline;
  });

  app.post("/api/v1/applications/:id/recompute", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    try {
      const out = await recomputeApplication(app.db, id);
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
}
