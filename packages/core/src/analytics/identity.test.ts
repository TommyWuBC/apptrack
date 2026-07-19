import { describe, expect, it } from "vitest";
import {
  computeVisitorHash,
  dailyVisitorSalt,
  partitionIncrementalEvents,
  parseCoarseUa,
  sessionizeEvents,
  ANALYTICS_SESSION_IDLE_MS,
} from "./identity.js";

describe("analytics identity", () => {
  it("daily salt is stable within a UTC day", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const a = dailyVisitorSalt("secret", now);
    const b = dailyVisitorSalt("secret", new Date("2026-07-19T23:59:59Z"));
    const c = dailyVisitorSalt("secret", new Date("2026-07-20T00:00:01Z"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("visitor hash changes with IP and does not embed IP", () => {
    const salt = dailyVisitorSalt("s", new Date("2026-07-19T00:00:00Z"));
    const h1 = computeVisitorHash({
      dailySalt: salt,
      siteKey: "pk_test",
      ip: "1.2.3.4",
      uaFamily: "chrome",
    });
    const h2 = computeVisitorHash({
      dailySalt: salt,
      siteKey: "pk_test",
      ip: "5.6.7.8",
      uaFamily: "chrome",
    });
    expect(h1).not.toBe(h2);
    expect(h1).not.toContain("1.2.3.4");
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("parses coarse UA categories", () => {
    expect(parseCoarseUa("Mozilla/5.0 (iPhone) Safari/604.1").deviceCategory).toBe(
      "mobile",
    );
    expect(parseCoarseUa("Mozilla/5.0 Chrome/120.0").browserFamily).toBe(
      "chrome",
    );
    expect(parseCoarseUa("Googlebot/2.1").deviceCategory).toBe("bot");
  });

  it("sessionizes with 30-minute idle windows", () => {
    const t0 = new Date("2026-07-19T10:00:00Z");
    const t1 = new Date(t0.getTime() + 10 * 60_000);
    const t2 = new Date(t1.getTime() + ANALYTICS_SESSION_IDLE_MS + 60_000);
    const sessions = sessionizeEvents([
      { occurredAt: t2, path: "/b" },
      { occurredAt: t0, path: "/a" },
      { occurredAt: t1, path: "/a2" },
    ]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.events).toHaveLength(2);
    expect(sessions[0]!.entryPath).toBe("/a");
    expect(sessions[1]!.events).toHaveLength(1);
    expect(sessions[1]!.entryPath).toBe("/b");
  });

  it("extends a persisted session across aggregate runs", () => {
    const out = partitionIncrementalEvents(
      [
        {
          occurredAt: new Date("2026-07-19T10:15:00Z"),
          path: "/projects",
        },
        {
          occurredAt: new Date("2026-07-19T11:00:00Z"),
          path: "/resume",
        },
      ],
      new Date("2026-07-19T10:10:00Z"),
    );
    expect(out.append.map((event) => event.path)).toEqual(["/projects"]);
    expect(out.remaining.map((event) => event.path)).toEqual(["/resume"]);
  });
});
