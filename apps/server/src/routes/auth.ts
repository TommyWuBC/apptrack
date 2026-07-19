import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { AuthCredentialsV1Schema, ErrorCode } from "@apptrack/shared";
import { repos } from "@apptrack/db";
import type { AuthConfig } from "../config.js";
import { generateCsrfToken } from "../auth/security.js";
import { loginOwner, setupOwner } from "../auth/session-service.js";
import { TokenBucketLimiter } from "../services/rate-limit.js";

const loginLimiter = new TokenBucketLimiter(5, 5 / 60_000);

function sourceKey(req: FastifyRequest): string {
  return createHash("sha256")
    .update(req.ip || "unknown")
    .digest("hex");
}

function coarseCountry(req: FastifyRequest): string | null {
  const value = req.headers["cf-ipcountry"] ?? req.headers["x-vercel-ip-country"];
  return typeof value === "string" && /^[A-Z]{2}$/i.test(value)
    ? value.toUpperCase()
    : null;
}

function setAuthCookies(
  reply: FastifyReply,
  config: AuthConfig,
  session: {
    token: string;
    csrfToken: string;
    expiresAt: Date;
  },
): void {
  const common = {
    path: "/",
    sameSite: "lax" as const,
    secure: config.cookieSecure,
    expires: session.expiresAt,
  };
  reply.setCookie(config.cookieName, session.token, {
    ...common,
    httpOnly: true,
  });
  reply.setCookie(config.csrfCookieName, session.csrfToken, {
    ...common,
    httpOnly: false,
  });
}

function publicUser(session: {
  user: { id: string; email: string; role: string };
  csrfToken: string;
}) {
  return {
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
    csrfToken: session.csrfToken,
  };
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  config: AuthConfig,
): Promise<void> {
  app.get("/api/v1/auth/status", async (_req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    return { setupRequired: (await repos.usersRepo.countUsers(app.db)) === 0 };
  });

  app.post("/api/v1/auth/setup", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const parsed = AuthCredentialsV1Schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "invalid_setup",
          details: parsed.error.flatten(),
        },
      });
    }
    try {
      const session = await setupOwner(app.db, config, parsed.data, coarseCountry(req));
      setAuthCookies(reply, config, session);
      return reply.code(201).send(publicUser(session));
    } catch (error) {
      if ((error as { code?: string }).code === "CONFLICT") {
        return reply.code(409).send({
          error: { code: ErrorCode.CONFLICT, message: "setup_already_completed" },
        });
      }
      throw error;
    }
  });

  app.post("/api/v1/auth/login", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    if (!loginLimiter.allow(sourceKey(req))) {
      return reply.code(429).send({
        error: { code: ErrorCode.RATE_LIMITED, message: "login_rate_limited" },
      });
    }
    const parsed = AuthCredentialsV1Schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: ErrorCode.VALIDATION_ERROR, message: "invalid_login" },
      });
    }
    try {
      const session = await loginOwner(app.db, config, parsed.data, coarseCountry(req));
      setAuthCookies(reply, config, session);
      return publicUser(session);
    } catch (error) {
      if ((error as { code?: string }).code === "UNAUTHORIZED") {
        return reply.code(401).send({
          error: { code: ErrorCode.UNAUTHORIZED, message: "invalid_credentials" },
        });
      }
      throw error;
    }
  });

  app.get("/api/v1/auth/me", async (req, reply) => {
    if (!req.authUser || !req.sessionTokenHash) {
      return reply.code(401).send({
        error: { code: ErrorCode.UNAUTHORIZED, message: "authentication_required" },
      });
    }
    const csrfToken = generateCsrfToken(req.sessionTokenHash, config.sessionSecret);
    reply.setCookie(config.csrfCookieName, csrfToken, {
      path: "/",
      sameSite: "lax",
      secure: config.cookieSecure,
      httpOnly: false,
    });
    return {
      userId: req.authUser.id,
      email: req.authUser.email,
      role: req.authUser.role,
      csrfToken,
    };
  });

  app.post("/api/v1/auth/logout", async (req, reply) => {
    if (app.db && req.sessionTokenHash) {
      await repos.sessionsRepo.deleteSession(app.db, req.sessionTokenHash);
      if (req.userId) {
        await repos.correctionsRepo.writeAuditLog(app.db, {
          userId: req.userId,
          actor: "user",
          action: "auth.logout",
          targetType: "user",
          targetId: req.userId,
        });
      }
    }
    reply.clearCookie(config.cookieName, { path: "/" });
    reply.clearCookie(config.csrfCookieName, { path: "/" });
    return reply.code(204).send();
  });
}
