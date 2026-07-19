import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { EventType } from "@apptrack/shared";
import { matchApplication } from "./match.js";
import { AUTO_ATTACH_MARGIN, AUTO_ATTACH_THRESHOLD, REVIEW_FLOOR } from "./weights.js";
import type { MatchCandidateContext, MatchEmailContext } from "./signals.js";

function email(overrides: Partial<MatchEmailContext> = {}): MatchEmailContext {
  return {
    eventType: EventType.oa_invitation,
    occurredAt: new Date("2026-06-15T12:00:00Z"),
    fromAddress: "recruiter@initech.com",
    roleTitle: "Software Engineering Intern",
    ...overrides,
  };
}

function candidate(
  overrides: Partial<MatchCandidateContext> & { applicationId: string },
): MatchCandidateContext {
  return {
    currentState: "confirmation_received",
    lastEventAt: new Date("2026-06-01T12:00:00Z"),
    appliedAt: new Date("2026-05-20T12:00:00Z"),
    roleTitle: "Software Engineering Intern",
    sameThread: false,
    recruiterEmails: [],
    assessmentProviders: [],
    ...overrides,
  };
}

describe("matchApplication thresholds (§15.2)", () => {
  it("auto-attaches when score ≥ 0.75 and margin ≥ 0.2", () => {
    const result = matchApplication({
      email: email({
        eventType: EventType.oa_reminder,
        assessmentProvider: "HackerRank",
      }),
      candidates: [
        candidate({
          applicationId: "app-a",
          sameThread: true,
          assessmentProviders: ["HackerRank"],
        }),
        candidate({
          applicationId: "app-b",
          roleTitle: "Data Analyst",
          currentState: "applied",
        }),
      ],
    });
    expect(result.decision).toBe("auto_attached");
    expect(result.selectedApplicationId).toBe("app-a");
    expect(result.score).toBeGreaterThanOrEqual(AUTO_ATTACH_THRESHOLD);
    expect(result.margin).toBeGreaterThanOrEqual(AUTO_ATTACH_MARGIN);
    expect(result.candidates[0]!.signals.length).toBeGreaterThan(0);
  });

  it("sends ambiguous scores to review (never guesses)", () => {
    const result = matchApplication({
      email: email({
        eventType: EventType.interview_invitation,
        roleTitle: "Engineer",
      }),
      candidates: [
        candidate({
          applicationId: "app-1",
          roleTitle: "Backend Engineer",
          currentState: "assessment_received",
        }),
        candidate({
          applicationId: "app-2",
          roleTitle: "Frontend Engineer",
          currentState: "assessment_received",
        }),
      ],
    });
    expect(result.decision).toBe("review");
    expect(result.score).toBeGreaterThanOrEqual(REVIEW_FLOOR);
    // Both similar → small margin or mid-band score
    expect(
      result.score < AUTO_ATTACH_THRESHOLD || result.margin < AUTO_ATTACH_MARGIN,
    ).toBe(true);
  });

  it("creates new_application for confirmation when no strong match", () => {
    const result = matchApplication({
      email: email({
        eventType: EventType.application_confirmation,
        roleTitle: "Product Designer",
      }),
      candidates: [
        candidate({
          applicationId: "app-old",
          roleTitle: "DevOps Lead",
          currentState: "rejected",
          lastEventAt: new Date("2025-01-01T00:00:00Z"),
        }),
      ],
    });
    expect(result.decision).toBe("new_application");
    expect(result.selectedApplicationId).toBeNull();
  });

  it("unmatched non-confirmation goes to review, not new app", () => {
    const result = matchApplication({
      email: email({
        eventType: EventType.rejection,
        roleTitle: "Unrelated Role XYZ",
      }),
      candidates: [],
    });
    expect(result.decision).toBe("review");
    expect(result.reason).toMatch(/No candidate/i);
  });

  it("thread continuity dominates multi-role same company", () => {
    const result = matchApplication({
      email: email({ eventType: EventType.oa_invitation }),
      candidates: [
        candidate({
          applicationId: "role-a",
          roleTitle: "SWE Intern",
          sameThread: true,
        }),
        candidate({
          applicationId: "role-b",
          roleTitle: "SWE Intern",
          sameThread: false,
        }),
      ],
    });
    expect(result.decision).toBe("auto_attached");
    expect(result.selectedApplicationId).toBe("role-a");
  });

  it("requisition ID matches across reapplication", () => {
    const result = matchApplication({
      email: email({
        eventType: EventType.application_confirmation,
        requisitionId: "R-12345",
        roleTitle: "SWE Intern",
      }),
      candidates: [
        candidate({
          applicationId: "prior",
          currentState: "rejected",
          lastEventAt: new Date("2025-12-01T00:00:00Z"),
          requisitionId: "R-12345",
          roleTitle: "SWE Intern",
        }),
      ],
    });
    expect(result.decision).toBe("auto_attached");
    expect(result.selectedApplicationId).toBe("prior");
    const req = result.candidates[0]!.signals.find((s) => s.name === "requisitionOrUrl");
    expect(req?.fired).toBe(true);
  });

  it("assessment provider continuity boosts OA reminder", () => {
    const result = matchApplication({
      email: email({
        eventType: EventType.oa_reminder,
        assessmentProvider: "CodeSignal",
      }),
      candidates: [
        candidate({
          applicationId: "with-oa",
          currentState: "assessment_received",
          assessmentProviders: ["CodeSignal"],
        }),
        candidate({
          applicationId: "other",
          currentState: "applied",
          roleTitle: "Marketing Intern",
        }),
      ],
    });
    expect(result.selectedApplicationId).toBe("with-oa");
    const sig = result.candidates
      .find((c) => c.applicationId === "with-oa")!
      .signals.find((s) => s.name === "assessmentContinuity");
    expect(sig?.fired).toBe(true);
  });

  it("every decision includes stored signals on candidates", () => {
    const result = matchApplication({
      email: email(),
      candidates: [candidate({ applicationId: "x" })],
    });
    for (const c of result.candidates) {
      expect(c.signals.length).toBeGreaterThanOrEqual(8);
      expect(c.signals.every((s) => typeof s.contribution === "number")).toBe(true);
    }
    expect(result.matcherVersion).toBe("match-v1");
  });
});

describe("matchApplication determinism (property)", () => {
  it("same inputs ⇒ identical result regardless of candidate order", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            applicationId: fc.uuid(),
            sameThread: fc.boolean(),
            currentState: fc.constantFrom(
              "applied",
              "confirmation_received",
              "assessment_received",
              "rejected",
            ),
            roleTitle: fc.constantFrom(
              "Software Engineer",
              "Data Scientist",
              "SWE Intern",
            ),
          }),
          { minLength: 0, maxLength: 5 },
        ),
        (raw) => {
          // Dedupe ids
          const seen = new Set<string>();
          const candidates = raw
            .filter((c) => {
              if (seen.has(c.applicationId)) return false;
              seen.add(c.applicationId);
              return true;
            })
            .map((c) =>
              candidate({
                applicationId: c.applicationId,
                sameThread: c.sameThread,
                currentState: c.currentState,
                roleTitle: c.roleTitle,
              }),
            );

          const e = email({ eventType: EventType.oa_invitation });
          const a = matchApplication({ email: e, candidates });
          const b = matchApplication({
            email: e,
            candidates: [...candidates].reverse(),
          });
          expect(b).toEqual(a);
        },
      ),
      { numRuns: 40 },
    );
  });
});
