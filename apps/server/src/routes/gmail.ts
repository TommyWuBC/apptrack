import type { FastifyInstance } from "fastify";
import { AppError, ErrorCode, JobName } from "@apptrack/shared";
import type { ServerConfig } from "../config.js";
import { oauthRefreshSweep } from "../jobs/oauth-refresh-sweep.js";
import {
  beginGmailConnect,
  completeGmailCallback,
  disconnectGmailAccount,
  listGmailAccounts,
  requireOwnedGmailAccount,
  refreshGmailAccount,
} from "../services/gmail-oauth-service.js";

/**
 * Gmail OAuth routes. AGENTS.md §22
 * GET  /api/v1/gmail/connect
 * GET  /api/v1/gmail/callback
 * DELETE /api/v1/gmail/accounts/:id
 * POST /api/v1/gmail/accounts/:id/refresh  (admin/test + sweep)
 * GET  /api/v1/gmail/accounts
 */
export async function registerGmailRoutes(app: FastifyInstance, config: ServerConfig) {
  app.get("/api/v1/gmail/connect", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    try {
      const { authorizeUrl } = beginGmailConnect(config, req.userId!);
      // Browser flow: redirect. Agents/tests can pass ?format=json
      const format = (req.query as { format?: string }).format;
      if (format === "json") {
        return { authorizeUrl };
      }
      return reply.redirect(authorizeUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "connect_failed";
      return reply.code(400).send({
        error: { code: ErrorCode.VALIDATION_ERROR, message },
      });
    }
  });

  app.get("/api/v1/gmail/callback", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const q = req.query as { code?: string; state?: string; error?: string };
    if (q.error) {
      return reply.code(400).send({
        error: { code: ErrorCode.VALIDATION_ERROR, message: q.error },
      });
    }
    if (!q.code || !q.state) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "code and state are required",
        },
      });
    }
    try {
      const account = await completeGmailCallback(app.db, config, {
        code: q.code,
        state: q.state,
      });
      if (app.jobs) {
        await app.jobs.send(
          JobName.EMAIL_SYNC,
          { accountId: account.id },
          { singletonKey: `email.sync:${account.id}` },
        );
      }
      // Never include tokens. INV-4.
      const format = (req.query as { format?: string }).format;
      if (format === "json") {
        return { account };
      }
      return reply.redirect(
        `${config.appBaseUrl}/settings?gmail=connected&accountId=${account.id}`,
      );
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "INVALID_STATE") {
        return reply.code(400).send({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "invalid or expired OAuth state",
          },
        });
      }
      req.log.warn({ err: String(err) }, "gmail callback failed");
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "oauth_callback_failed",
        },
      });
    }
  });

  app.get("/api/v1/gmail/accounts", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const accounts = await listGmailAccounts(app.db, req.userId!);
    return { accounts };
  });

  app.delete("/api/v1/gmail/accounts/:id", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    try {
      await disconnectGmailAccount(app.db, config, id, req.userId!);
    } catch (err) {
      if ((err as { code?: string }).code === "ACCOUNT_NOT_FOUND") {
        return reply.code(404).send({
          error: { code: ErrorCode.NOT_FOUND, message: "account_not_found" },
        });
      }
      throw err;
    }
    return reply.code(204).send();
  });

  app.post("/api/v1/gmail/accounts/:id/refresh", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const { id } = req.params as { id: string };
    try {
      if (!req.isInternalJob) {
        await requireOwnedGmailAccount(app.db, id, req.userId!);
      }
      const result = await refreshGmailAccount(app.db, config, id);
      return {
        ok: true,
        accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
      };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "REAUTH_REQUIRED") {
        return reply.code(401).send({
          error: {
            code: ErrorCode.REAUTH_REQUIRED,
            message: "Google refresh token invalid; reconnect Gmail",
          },
        });
      }
      if (code === "ACCOUNT_NOT_FOUND") {
        return reply.code(404).send({
          error: { code: ErrorCode.NOT_FOUND, message: "account_not_found" },
        });
      }
      throw new AppError(ErrorCode.INTERNAL, "refresh_failed");
    }
  });

  app.post("/api/v1/gmail/refresh-sweep", async (_req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    return oauthRefreshSweep(app.db, config);
  });
}
