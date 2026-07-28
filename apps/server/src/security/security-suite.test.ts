/**
 * M17 security suite — §24.8 + headers / redaction / rate limits.
 * CSRF + session mutation paths that need Postgres live in auth-csrf.integration.test.ts.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import {
  CONTENT_SECURITY_POLICY,
  applySecurityHeaders,
} from "../plugins/security-headers.js";
import { LOG_REDACT_PATHS, isSensitiveLogField } from "../plugins/logger-redact.js";
import { apiSourceLimiter } from "../plugins/rate-limit-hook.js";
import { TokenBucketLimiter } from "../services/rate-limit.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("security headers (M17 / T4)", () => {
  it("CSP includes frame-ancestors none", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
  });

  it("healthz responses carry CSP, nosniff, DENY frame", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    await app.close();
  });

  it("applySecurityHeaders sets HSTS only when enabled", () => {
    const headers: Record<string, string> = {};
    const reply = {
      header(k: string, v: string) {
        headers[k.toLowerCase()] = v;
        return reply;
      },
    };
    applySecurityHeaders({} as never, reply as never, { enableHsts: false });
    expect(headers["strict-transport-security"]).toBeUndefined();
    applySecurityHeaders({} as never, reply as never, { enableHsts: true });
    expect(headers["strict-transport-security"]).toContain("max-age=");
  });
});

describe("auth gate (T3 / §24.8)", () => {
  const protectedGets = [
    "/api/v1/stats",
    "/api/v1/applications",
    "/api/v1/review",
    "/api/v1/auth/me",
  ];

  it.each(protectedGets)("%s without session → 401 or 503 (fail-closed)", async (url) => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url });
    expect([401, 503]).toContain(res.statusCode);
    await app.close();
  });

  it("mutation without session → 401 or 503", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sync/run",
      payload: {},
    });
    // Internal job route without secret + no session → 401/503
    expect([401, 403, 503]).toContain(res.statusCode);
    await app.close();
  });

  it("public health routes stay reachable", async () => {
    const app = await buildApp({ logger: false });
    const hz = await app.inject({ method: "GET", url: "/healthz" });
    const hello = await app.inject({ method: "GET", url: "/api/v1/hello" });
    expect(hz.statusCode).toBe(200);
    expect(hello.statusCode).toBe(200);
    await app.close();
  });
});

describe("CSRF contract (T5 / §24.8)", () => {
  it("auth plugin requires X-CSRF-Token on unsafe methods", () => {
    const src = readFileSync(join(here, "../plugins/auth.ts"), "utf8");
    expect(src).toContain("x-csrf-token");
    expect(src).toContain("csrf_token_invalid");
    expect(src).toContain("SAFE_METHODS");
  });
});

describe("log redaction (T11 / §24.8)", () => {
  it("covers tokens, cookies, and email body fields", () => {
    expect(LOG_REDACT_PATHS).toEqual(
      expect.arrayContaining([
        "req.headers.authorization",
        "req.headers.cookie",
        "*.password",
        "*.refreshToken",
        "*.accessToken",
        "*.subject",
        "*.textPlain",
        "*.fromAddress",
      ]),
    );
  });

  it("flags sensitive field names", () => {
    expect(isSensitiveLogField("subject")).toBe(true);
    expect(isSensitiveLogField("textPlain")).toBe(true);
    expect(isSensitiveLogField("fromAddress")).toBe(true);
    expect(isSensitiveLogField("refreshToken")).toBe(true);
    expect(isSensitiveLogField("messageId")).toBe(false);
    expect(isSensitiveLogField("jobId")).toBe(false);
  });

  it("pipeline-style log object must not keep PII keys when scrubbed", () => {
    const sample = {
      job: "email.classify",
      messageId: "11111111-1111-7111-8111-111111111111",
      subject: "Offer from Initech",
      fromAddress: "hr@initech.example",
      textPlain: "Congratulations",
    };
    const scrubbed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sample)) {
      if (!isSensitiveLogField(k)) scrubbed[k] = v;
    }
    expect(scrubbed).toEqual({
      job: "email.classify",
      messageId: "11111111-1111-7111-8111-111111111111",
    });
    expect(JSON.stringify(scrubbed)).not.toMatch(/Initech|hr@|Congratulations/i);
  });
});

describe("rate limits (T9 / F9 / §24.8)", () => {
  afterEach(() => {
    apiSourceLimiter.reset();
  });

  it("login limiter capacity is 5/min class", () => {
    const lim = new TokenBucketLimiter(5, 5 / 60_000);
    for (let i = 0; i < 5; i++) expect(lim.allow("login-ip")).toBe(true);
    expect(lim.allow("login-ip")).toBe(false);
  });

  it("global API limiter eventually 429s", async () => {
    apiSourceLimiter.reset();
    // Drain the shared limiter used by the plugin
    const capacity = 120;
    for (let i = 0; i < capacity; i++) {
      expect(apiSourceLimiter.allow("test-source")).toBe(true);
    }
    expect(apiSourceLimiter.allow("test-source")).toBe(false);

    const app = await buildApp({ logger: false });
    // Force same key as inject's default remoteAddress hashing — refill by resetting
    // then exhaust via inject against a public route that still counts.
    apiSourceLimiter.reset();
    let limited = false;
    for (let i = 0; i < 200; i++) {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/hello",
        remoteAddress: "203.0.113.50",
      });
      if (res.statusCode === 429) {
        limited = true;
        expect(res.json().error.code).toBe("RATE_LIMITED");
        break;
      }
    }
    expect(limited).toBe(true);
    await app.close();
  });
});

describe("evidence viewer sandbox (T4)", () => {
  it("EvidenceViewer uses empty sandbox attribute", () => {
    const src = readFileSync(
      join(here, "../../../../apps/web/src/components/EvidenceViewer.tsx"),
      "utf8",
    );
    expect(src).toContain('sandbox=""');
    expect(src).not.toContain("dangerouslySetInnerHTML");
  });
});
