/**
 * Unit-level orchestration tests with an in-memory-style stub are limited
 * without Postgres. Pure matcher coverage lives in packages/core.
 * This file documents wiring expectations for the service API shape.
 */
import { describe, expect, it } from "vitest";
import { MATCHER_VERSION, matchApplication } from "@apptrack/core";
import { EventType } from "@apptrack/shared";

describe("application-match-service contracts", () => {
  it("exports matcher version used by routes", () => {
    expect(MATCHER_VERSION).toBe("match-v1");
  });

  it("confirmation with empty candidates → new_application", () => {
    const r = matchApplication({
      email: {
        eventType: EventType.application_confirmation,
        occurredAt: new Date(),
        roleTitle: "SWE Intern",
      },
      candidates: [],
    });
    expect(r.decision).toBe("new_application");
  });
});
