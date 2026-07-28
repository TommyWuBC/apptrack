/**
 * App-wide security headers. AGENTS.md §6.2 T4 / M17
 * No external helmet dependency — explicit allowlist we can audit.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/** CSP for API + SPA shell. Email HTML is never rendered in this document context. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
].join("; ");

export function applySecurityHeaders(
  _req: FastifyRequest,
  reply: FastifyReply,
  opts: { enableHsts: boolean },
): void {
  reply.header("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  reply.header("Cross-Origin-Opener-Policy", "same-origin");
  reply.header("Cross-Origin-Resource-Policy", "same-site");
  if (opts.enableHsts) {
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

/** Register onResponse hook so every reply (incl. errors) carries headers. */
export async function registerSecurityHeadersPlugin(
  app: FastifyInstance,
  opts: { enableHsts?: boolean } = {},
): Promise<void> {
  const enableHsts =
    opts.enableHsts ??
    (process.env.NODE_ENV === "production" || process.env.ENABLE_HSTS === "true");

  app.addHook("onSend", async (req, reply) => {
    applySecurityHeaders(req, reply, { enableHsts });
  });
}
