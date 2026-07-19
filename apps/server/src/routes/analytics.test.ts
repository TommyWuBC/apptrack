import { describe, expect, it } from "vitest";
import { TokenBucketLimiter } from "../services/rate-limit.js";
import { resolveGeo } from "../services/geo-lookup.js";
import { originAllowed } from "../services/analytics-ingest-service.js";
import {
  AnalyticsIngestBatchV1Schema,
  ANALYTICS_PROP_KEYS,
} from "@apptrack/shared";
import { buildApp } from "../app.js";

describe("rate limiter", () => {
  it("allows up to capacity then rejects", () => {
    const lim = new TokenBucketLimiter(2, 0);
    expect(lim.allow("a")).toBe(true);
    expect(lim.allow("a")).toBe(true);
    expect(lim.allow("a")).toBe(false);
  });
});

describe("originAllowed", () => {
  it("allows any origin when allowlist empty (dev)", () => {
    expect(originAllowed("https://example.com", [])).toBe(true);
  });
  it("matches allowlist origins", () => {
    expect(
      originAllowed("https://portfolio.example", [
        "https://portfolio.example",
      ]),
    ).toBe(true);
    expect(
      originAllowed("https://evil.example", ["https://portfolio.example"]),
    ).toBe(false);
  });
});

describe("resolveGeo", () => {
  it("no_geo uses CDN country only", () => {
    const g = resolveGeo({
      mode: "no_geo",
      headers: { "cf-ipcountry": "US" },
      ip: "8.8.8.8",
    });
    expect(g.country).toBe("US");
    expect(g.city).toBeNull();
  });
  it("full uses lookup when provided", () => {
    const g = resolveGeo({
      mode: "full",
      ip: "1.1.1.1",
      lookup: () => ({ country: "CA", region: "BC", city: "Vancouver" }),
    });
    expect(g.city).toBe("Vancouver");
  });
});

describe("ingest batch schema", () => {
  it("rejects non-allowlisted props keys", () => {
    const bad = AnalyticsIngestBatchV1Schema.safeParse({
      siteKey: "pk_abcdefgh",
      events: [
        {
          eventId: "11111111-1111-4111-8111-111111111111",
          eventType: "page_view",
          occurredAt: new Date().toISOString(),
          props: { fingerprint: "x" },
        },
      ],
    });
    expect(bad.success).toBe(false);
  });
  it("accepts allowlisted props", () => {
    expect(ANALYTICS_PROP_KEYS).toContain("utm_source");
    const ok = AnalyticsIngestBatchV1Schema.safeParse({
      siteKey: "pk_abcdefgh",
      events: [
        {
          eventId: "11111111-1111-4111-8111-111111111111",
          eventType: "page_view",
          occurredAt: new Date().toISOString(),
          path: "/",
          props: { title: "Home", utm_source: "li" },
        },
      ],
    });
    expect(ok.success).toBe(true);
  });
  it("caps batch at 25", () => {
    const events = Array.from({ length: 26 }, (_, i) => ({
      eventId: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      eventType: "page_view" as const,
      occurredAt: new Date().toISOString(),
    }));
    const bad = AnalyticsIngestBatchV1Schema.safeParse({
      siteKey: "pk_abcdefgh",
      events,
    });
    expect(bad.success).toBe(false);
  });
});

describe("analytics routes", () => {
  it("POST ingest without DB → 503", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/analytics/events",
      payload: { siteKey: "pk_test", events: [] },
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("GET sites without DB → 503", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/sites",
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
