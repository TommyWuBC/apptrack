import cookie from "@fastify/cookie";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { ErrorCode } from "@apptrack/shared";
import { repos } from "@apptrack/db";
import type { AuthConfig } from "../config.js";
import { hashSessionToken, verifyCsrfToken } from "../auth/security.js";

const PUBLIC_ROUTES = new Set([
  "GET /healthz",
  "GET /readyz",
  "GET /sdk.js",
  "GET /api/v1/hello",
  "GET /api/v1/core-ping",
  "GET /api/v1/db-ping",
  "GET /api/v1/applications/reducer-version",
  "GET /api/v1/classify/version",
  "GET /api/v1/normalize/version",
  "GET /api/v1/match/version",
  "GET /api/v1/ghost/version",
  "GET /api/v1/correlation/version",
  "GET /api/v1/settings/classifier",
  "POST /api/v1/auth/setup",
  "POST /api/v1/auth/login",
  "GET /api/v1/auth/status",
  "GET /api/v1/gmail/callback",
  "POST /api/v1/analytics/events",
  "OPTIONS /api/v1/analytics/events",
  "GET /r/:token/resume.pdf",
]);

const INTERNAL_JOB_ROUTES = new Set([
  "POST /api/v1/sync/run",
  "POST /api/v1/ghost/evaluate",
  "POST /api/v1/analytics/aggregate",
  "POST /api/v1/analytics/retention",
  "POST /api/v1/correlation/score",
  "POST /api/v1/backfill",
  "POST /api/v1/normalize/:messageId",
  "POST /api/v1/classify/:messageId",
  "POST /api/v1/match/:messageId",
  "POST /api/v1/match/reevaluate/:companyId",
  "POST /api/v1/applications/:id/recompute",
  "POST /api/v1/gmail/refresh-sweep",
  "POST /api/v1/reprocess/execute",
]);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function pathTemplate(req: FastifyRequest): string {
  return req.routeOptions.url ?? req.url.split("?")[0]!;
}

function constantEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isInternalRequest(req: FastifyRequest, config: AuthConfig): boolean {
  const route = `${req.method} ${pathTemplate(req)}`;
  if (!INTERNAL_JOB_ROUTES.has(route)) return false;
  const token = req.headers["x-apptrack-internal"];
  return typeof token === "string" && constantEqual(token, config.internalJobSecret);
}

/** DB-backed sessions + double-submit CSRF. AGENTS.md §6.2 T3/T5. */
export async function registerAuthPlugin(
  app: FastifyInstance,
  config: AuthConfig,
): Promise<void> {
  await app.register(cookie);

  app.addHook("preHandler", async (req, reply) => {
    const route = `${req.method} ${pathTemplate(req)}`;
    if (PUBLIC_ROUTES.has(route)) return;
    if (isInternalRequest(req, config)) {
      req.isInternalJob = true;
    }

    // Authentication must fail closed when its backing store is unavailable.
    // Public liveness/setup routes remain reachable above.
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }

    if (req.isInternalJob) return;

    const rawToken = req.cookies[config.cookieName];
    if (!rawToken) {
      return reply.code(401).send({
        error: { code: ErrorCode.UNAUTHORIZED, message: "authentication_required" },
      });
    }
    const tokenHash = hashSessionToken(rawToken);
    const session = await repos.sessionsRepo.getActiveSession(app.db, tokenHash);
    if (!session) {
      reply.clearCookie(config.cookieName, { path: "/" });
      reply.clearCookie(config.csrfCookieName, { path: "/" });
      return reply.code(401).send({
        error: { code: ErrorCode.UNAUTHORIZED, message: "session_expired" },
      });
    }
    const user = await repos.usersRepo.getUserById(app.db, session.userId);
    if (!user) {
      await repos.sessionsRepo.deleteSession(app.db, tokenHash);
      return reply.code(401).send({
        error: { code: ErrorCode.UNAUTHORIZED, message: "authentication_required" },
      });
    }

    req.userId = user.id;
    req.authUser = { id: user.id, email: user.email, role: user.role };
    req.sessionTokenHash = tokenHash;

    if (!SAFE_METHODS.has(req.method)) {
      const cookieToken = req.cookies[config.csrfCookieName];
      const headerToken = req.headers["x-csrf-token"];
      if (
        !cookieToken ||
        typeof headerToken !== "string" ||
        !constantEqual(cookieToken, headerToken) ||
        !verifyCsrfToken(cookieToken, tokenHash, config.sessionSecret)
      ) {
        return reply.code(403).send({
          error: { code: ErrorCode.FORBIDDEN, message: "csrf_token_invalid" },
        });
      }
    }

    const idleExpiresAt = new Date(Date.now() + config.sessionIdleMs);
    await repos.sessionsRepo.touchSession(app.db, tokenHash, idleExpiresAt);
  });
}

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    authUser?: { id: string; email: string; role: string };
    sessionTokenHash?: string;
    isInternalJob?: boolean;
  }
}
