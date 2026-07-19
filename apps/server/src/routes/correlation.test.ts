import { describe, expect, it } from "vitest";
import { BANNED_CORRELATION_PHRASES, containsBannedCorrelationPhrase } from "@apptrack/core";
import { buildApp } from "../app.js";
import { mintUniqueLinkToken } from "../services/links-service.js";
import { correlationEnabled } from "../services/correlation-score-service.js";

describe("mintUniqueLinkToken", () => {
  it("returns 8-char unguessable-ish tokens", () => {
    const a = mintUniqueLinkToken();
    const b = mintUniqueLinkToken();
    expect(a).toHaveLength(8);
    expect(b).toHaveLength(8);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9A-Za-z]+$/);
  });
});

describe("correlationEnabled", () => {
  it("defaults off", () => {
    expect(correlationEnabled({})).toBe(false);
    expect(correlationEnabled({ CORRELATION_ENABLED: "false" })).toBe(false);
  });
  it("accepts truthy flags", () => {
    expect(correlationEnabled({ CORRELATION_ENABLED: "true" })).toBe(true);
    expect(correlationEnabled({ CORRELATION_ENABLED: "1" })).toBe(true);
    expect(correlationEnabled({ CORRELATION_ENABLED: "on" })).toBe(true);
  });
});

describe("correlation banned phrases (API surface)", () => {
  it("keeps banned list non-empty and detectable", () => {
    expect(BANNED_CORRELATION_PHRASES.length).toBeGreaterThan(0);
    expect(containsBannedCorrelationPhrase("recruiter viewed the site")).toBe(
      "recruiter viewed",
    );
    expect(
      containsBannedCorrelationPhrase(
        "Anonymous visit potentially associated with this application",
      ),
    ).toBeNull();
  });
});

describe("correlation routes", () => {
  it("GET version is public", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/correlation/version",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { algorithmVersion: string; enabled: boolean };
    expect(body.algorithmVersion).toBe("corr-v1");
    expect(typeof body.enabled).toBe("boolean");
    await app.close();
  });

  it("GET correlations without auth → 401 when DB down is 503", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/correlations?applicationId=00000000-0000-7000-8000-000000000001",
    });
    // No DB in unit harness → fail-closed 503 before/at auth.
    expect([401, 503]).toContain(res.statusCode);
    await app.close();
  });

  it("GET tracked resume without DB → 503", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/r/DemoTok1/resume.pdf",
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
