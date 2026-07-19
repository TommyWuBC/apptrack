import { describe, expect, it, vi } from "vitest";
import {
  createTracker,
  endpointFromScriptSrc,
  readScriptConfig,
} from "./tracker.js";
import { gzipSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

describe("createTracker", () => {
  it("no-ops when mode=off", () => {
    const send = vi.fn();
    const t = createTracker({
      siteKey: "pk_x",
      endpoint: "http://t/api/v1/analytics/events",
      mode: "off",
      send,
    });
    t.track("page_view");
    t.flush();
    expect(send).not.toHaveBeenCalled();
  });

  it("batches events and uses sendBeacon-style send", () => {
    const send = vi.fn();
    let n = 0;
    const t = createTracker({
      siteKey: "pk_test",
      endpoint: "http://tracker/api/v1/analytics/events",
      send,
      flushMs: 60_000,
      batchSize: 2,
      autoPageView: false,
      hookHistory: false,
      uuid: () => `11111111-1111-4111-8111-${String(++n).padStart(12, "0")}`,
      now: () => new Date("2026-07-19T12:00:00Z"),
      getPath: () => "/",
      getSearch: () => "?src=abc123",
    });
    t.track("page_view", { title: "Home" });
    expect(send).not.toHaveBeenCalled();
    t.track("github_click", { href: "https://github.com/x" });
    expect(send).toHaveBeenCalledTimes(1);
    const body = JSON.parse(send.mock.calls[0]![1] as string) as {
      siteKey: string;
      events: Array<{ srcToken?: string; eventType: string }>;
    };
    expect(body.siteKey).toBe("pk_test");
    expect(body.events).toHaveLength(2);
    expect(body.events[0]!.srcToken).toBe("abc123");
    expect(body.events[1]!.eventType).toBe("github_click");
  });

  it("falls back to flush on demand (sendBeacon fallback path)", () => {
    const send = vi.fn();
    const t = createTracker({
      siteKey: "pk_test",
      endpoint: "/api/v1/analytics/events",
      send,
      flushMs: 60_000,
      batchSize: 25,
      autoPageView: false,
      hookHistory: false,
      getPath: () => "/projects",
      getSearch: () => "",
      uuid: () => "22222222-2222-4222-8222-222222222222",
      now: () => new Date("2026-07-19T12:00:00Z"),
    });
    t.track("project_view", { project: "portfolio" });
    t.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("strips non-allowlisted props", () => {
    const send = vi.fn();
    const t = createTracker({
      siteKey: "pk_test",
      endpoint: "/api/v1/analytics/events",
      send,
      flushMs: 60_000,
      autoPageView: false,
      hookHistory: false,
      getPath: () => "/",
      getSearch: () => "",
      uuid: () => "33333333-3333-4333-8333-333333333333",
      now: () => new Date("2026-07-19T12:00:00Z"),
    });
    t.track("page_view", {
      title: "OK",
      fingerprint: "evil",
    } as Record<string, string>);
    t.flush();
    const body = JSON.parse(send.mock.calls[0]![1] as string) as {
      events: Array<{ props?: Record<string, string> }>;
    };
    expect(body.events[0]!.props).toEqual({ title: "OK" });
  });
});

describe("script helpers", () => {
  it("endpointFromScriptSrc maps /sdk.js → ingest path", () => {
    expect(endpointFromScriptSrc("https://t.example/sdk.js")).toBe(
      "https://t.example/api/v1/analytics/events",
    );
  });

  it("readScriptConfig reads data attributes", () => {
    const el = {
      getAttribute: (n: string) =>
        ({ "data-site-key": "pk_1", "data-mode": "no_geo", src: "" }[n] ??
        null),
      src: "http://localhost:3000/sdk.js",
    } as unknown as HTMLScriptElement;
    const cfg = readScriptConfig(el);
    expect(cfg?.siteKey).toBe("pk_1");
    expect(cfg?.mode).toBe("no_geo");
    expect(cfg?.endpoint).toContain("/api/v1/analytics/events");
  });
});

describe("sdk.js size gate", () => {
  it("gzip size is under 2KB when built", () => {
    const dist = join(
      dirname(fileURLToPath(import.meta.url)),
      "../dist/sdk.js",
    );
    expect(existsSync(dist), "dist/sdk.js missing — run build first").toBe(true);
    const gz = gzipSync(readFileSync(dist));
    expect(gz.length).toBeLessThan(2048);
  });
});
