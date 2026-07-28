/**
 * Global per-source API rate limit (hashed IP). AGENTS.md M17 / F9
 * Complements login + analytics bucket limiters.
 */
import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ErrorCode } from "@apptrack/shared";
import { TokenBucketLimiter } from "../services/rate-limit.js";

/** ~120 requests / minute per hashed client key. */
export const apiSourceLimiter = new TokenBucketLimiter(120, 120 / 60_000);

const EXEMPT_PREFIXES = ["/healthz", "/readyz", "/sdk.js", "/metrics"];

function sourceKey(req: FastifyRequest): string {
  return createHash("sha256")
    .update(req.ip || "unknown")
    .digest("hex");
}

export async function registerApiRateLimitPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (req, reply) => {
    const path = req.url.split("?")[0] ?? "";
    if (EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      return;
    }
    if (!apiSourceLimiter.allow(sourceKey(req))) {
      return reply.code(429).send({
        error: { code: ErrorCode.RATE_LIMITED, message: "api_rate_limited" },
      });
    }
  });
}
