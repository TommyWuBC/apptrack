import { describe, expect, it } from "vitest";
import {
  BANNED_CORRELATION_PHRASES,
  containsBannedCorrelationPhrase,
  scoreCorrelation,
  CORRELATION_VERSION,
} from "./index.js";

describe("correlation language", () => {
  it("flags every banned phrase", () => {
    for (const phrase of BANNED_CORRELATION_PHRASES) {
      expect(containsBannedCorrelationPhrase(`Something ${phrase} here`)).toBe(
        phrase,
      );
    }
    expect(containsBannedCorrelationPhrase("Visited by Acme")).toBe("visited by");
    expect(containsBannedCorrelationPhrase("Anonymous visit potentially associated")).toBeNull();
  });
});

describe("scoreCorrelation", () => {
  const baseApp = {
    applicationId: "00000000-0000-7000-8000-000000000001",
    appliedAt: new Date("2026-07-01T12:00:00Z"),
    uniqueLinkToken: null as string | null,
    companyName: "Initech",
    companyLocations: [{ city: "Seattle", region: "WA", country: "US", timezone: "America/Los_Angeles" }],
    recentEvents: [
      {
        eventType: "interview_invitation",
        occurredAt: new Date("2026-07-17T15:00:00Z"),
      },
    ],
    activeApplicationsSharingMetro: 1,
  };

  const baseSession = {
    sessionId: "00000000-0000-7000-8000-000000000010",
    visitorHash: "abc",
    startedAt: new Date("2026-07-19T18:00:00Z"),
    referrerHost: "linkedin.com",
    geoCountry: "US",
    geoRegion: "WA",
    geoCity: "Seattle",
    sameDayVisitCount: 2,
  };

  it("returns deterministic high for unique link token", () => {
    const out = scoreCorrelation({
      application: { ...baseApp, uniqueLinkToken: "AbCdEfGh" },
      session: baseSession,
      events: [
        {
          eventType: "page_view",
          occurredAt: baseSession.startedAt,
          srcToken: "AbCdEfGh",
          path: "/",
        },
      ],
    });
    expect(out).not.toBeNull();
    expect(out!.deterministic).toBe(true);
    expect(out!.confidenceBand).toBe("high");
    expect(out!.score).toBe(1);
    expect(out!.algorithmVersion).toBe(CORRELATION_VERSION);
    expect(containsBannedCorrelationPhrase(out!.explanation)).toBeNull();
  });

  it("scores probabilistic path and caps below high", () => {
    const out = scoreCorrelation({
      application: baseApp,
      session: baseSession,
      events: [
        {
          eventType: "resume_download",
          occurredAt: baseSession.startedAt,
          path: "/resume",
        },
        {
          eventType: "project_view",
          occurredAt: baseSession.startedAt,
          path: "/projects/foo",
        },
      ],
    });
    expect(out).not.toBeNull();
    expect(out!.deterministic).toBe(false);
    expect(out!.confidenceBand).toBe("medium");
    expect(out!.score).toBeGreaterThan(0.55);
    expect(out!.score).toBeLessThan(1);
    expect(out!.explanation.toLowerCase()).not.toContain("recruiter viewed");
    expect(out!.explanation.toLowerCase()).not.toContain("definitely");
  });

  it("applies ambiguity divisor for shared metro", () => {
    const one = scoreCorrelation({
      application: { ...baseApp, activeApplicationsSharingMetro: 1 },
      session: baseSession,
      events: [{ eventType: "page_view", occurredAt: baseSession.startedAt }],
    });
    const many = scoreCorrelation({
      application: { ...baseApp, activeApplicationsSharingMetro: 4 },
      session: baseSession,
      events: [{ eventType: "page_view", occurredAt: baseSession.startedAt }],
    });
    expect(one).not.toBeNull();
    expect(many).not.toBeNull();
    expect(many!.score).toBeLessThan(one!.score);
    expect(many!.explanation).toMatch(/4 of your active applications/);
  });

  it("returns null when score is below display threshold", () => {
    const out = scoreCorrelation({
      application: {
        ...baseApp,
        companyLocations: [],
        recentEvents: [],
        activeApplicationsSharingMetro: 1,
      },
      session: {
        ...baseSession,
        referrerHost: null,
        geoCity: null,
        geoRegion: null,
        sameDayVisitCount: 1,
      },
      events: [{ eventType: "page_view", occurredAt: baseSession.startedAt }],
    });
    expect(out).toBeNull();
  });

  it("ignores sessions before appliedAt", () => {
    const out = scoreCorrelation({
      application: baseApp,
      session: {
        ...baseSession,
        startedAt: new Date("2026-06-01T12:00:00Z"),
      },
      events: [],
    });
    expect(out).toBeNull();
  });
});
