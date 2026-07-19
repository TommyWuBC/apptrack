import { describe, expect, it } from "vitest";
import { ApplicationState, GhostStatus } from "@apptrack/shared";
import { evaluateGhost } from "./evaluate.js";
import { DEFAULT_GHOST_THRESHOLDS, resolveGhostThresholds } from "./thresholds.js";
import { GHOST_VERSION } from "./version.js";

const NOW = new Date("2026-07-01T12:00:00.000Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

describe("resolveGhostThresholds", () => {
  it("defaults to 45/90", () => {
    const t = resolveGhostThresholds();
    expect(t.staleAfterDays).toBe(45);
    expect(t.ghostAfterDays).toBe(90);
    expect(t.source).toBe("default");
  });

  it("applies per-stage override (final_round)", () => {
    const t = resolveGhostThresholds({
      currentState: ApplicationState.final_round,
    });
    expect(t.staleAfterDays).toBe(21);
    expect(t.ghostAfterDays).toBe(45);
    expect(t.source).toBe("stage:final_round");
  });

  it("type overrides stage; company overrides type", () => {
    const withType = resolveGhostThresholds({
      currentState: ApplicationState.final_round,
      applicationType: "internship",
    });
    expect(withType.staleAfterDays).toBe(30);
    expect(withType.source).toBe("type:internship");

    const withCompany = resolveGhostThresholds({
      currentState: ApplicationState.final_round,
      applicationType: "internship",
      companyId: "co-1",
      settings: {
        perCompany: {
          "co-1": { staleAfterDays: 10, ghostAfterDays: 20 },
        },
      },
    });
    expect(withCompany.staleAfterDays).toBe(10);
    expect(withCompany.ghostAfterDays).toBe(20);
    expect(withCompany.source).toBe("company:co-1");
  });
});

describe("evaluateGhost — matrix", () => {
  it("marks stale after stale threshold", () => {
    const r = evaluateGhost({
      currentGhostStatus: GhostStatus.none,
      currentState: ApplicationState.confirmation_received,
      lastMeaningfulAt: daysAgo(50),
      hasFutureScheduled: false,
      terminal: false,
      now: NOW,
    });
    expect(r.action).toBe("mark_stale");
    expect(r.nextStatus).toBe(GhostStatus.stale);
    expect(r.daysInactive).toBe(50);
    expect(r.algorithmVersion).toBe(GHOST_VERSION);
  });

  it("marks possibly_ghosted after ghost threshold", () => {
    const r = evaluateGhost({
      currentGhostStatus: GhostStatus.stale,
      currentState: ApplicationState.interviewing,
      lastMeaningfulAt: daysAgo(95),
      hasFutureScheduled: false,
      terminal: false,
      now: NOW,
    });
    expect(r.action).toBe("mark_ghosted");
    expect(r.nextStatus).toBe(GhostStatus.possibly_ghosted);
  });

  it("pauses while future interview/OA scheduled", () => {
    const r = evaluateGhost({
      currentGhostStatus: GhostStatus.none,
      currentState: ApplicationState.interviewing,
      lastMeaningfulAt: daysAgo(100),
      hasFutureScheduled: true,
      terminal: false,
      now: NOW,
    });
    expect(r.paused).toBe(true);
    expect(r.action).toBe("none");
    expect(r.nextStatus).toBe(GhostStatus.none);
  });

  it("resets (clear) when activity within stale window", () => {
    const r = evaluateGhost({
      currentGhostStatus: GhostStatus.possibly_ghosted,
      currentState: ApplicationState.ghosted,
      lastMeaningfulAt: daysAgo(5),
      hasFutureScheduled: false,
      terminal: false,
      now: NOW,
    });
    expect(r.action).toBe("clear");
    expect(r.nextStatus).toBe(GhostStatus.none);
  });

  it("terminal states never ghost and clear prior flags", () => {
    const none = evaluateGhost({
      currentGhostStatus: GhostStatus.none,
      currentState: ApplicationState.rejected,
      lastMeaningfulAt: daysAgo(200),
      hasFutureScheduled: false,
      terminal: true,
      now: NOW,
    });
    expect(none.action).toBe("none");

    const clear = evaluateGhost({
      currentGhostStatus: GhostStatus.stale,
      currentState: ApplicationState.offer,
      lastMeaningfulAt: daysAgo(200),
      hasFutureScheduled: false,
      terminal: true,
      now: NOW,
    });
    expect(clear.action).toBe("clear");
  });

  it("dismiss suppresses until state change", () => {
    const kept = evaluateGhost({
      currentGhostStatus: GhostStatus.dismissed,
      currentState: ApplicationState.interviewing,
      lastMeaningfulAt: daysAgo(100),
      hasFutureScheduled: false,
      terminal: false,
      dismissedAtState: ApplicationState.interviewing,
      now: NOW,
    });
    expect(kept.action).toBe("keep_dismissed");
    expect(kept.nextStatus).toBe(GhostStatus.dismissed);

    const afterStateChange = evaluateGhost({
      currentGhostStatus: GhostStatus.dismissed,
      currentState: ApplicationState.final_round,
      lastMeaningfulAt: daysAgo(100),
      hasFutureScheduled: false,
      terminal: false,
      dismissedAtState: ApplicationState.interviewing,
      now: NOW,
    });
    expect(afterStateChange.action).toBe("mark_ghosted");
    expect(afterStateChange.nextStatus).toBe(GhostStatus.possibly_ghosted);
  });

  it("uses per-stage thresholds (final_round shorter window)", () => {
    const r = evaluateGhost({
      currentGhostStatus: GhostStatus.none,
      currentState: ApplicationState.final_round,
      lastMeaningfulAt: daysAgo(25),
      hasFutureScheduled: false,
      terminal: false,
      now: NOW,
      settings: DEFAULT_GHOST_THRESHOLDS,
    });
    // default final_round stale=21 ghost=45 → 25d → stale
    expect(r.action).toBe("mark_stale");
    expect(r.evidence).toContain("stage:final_round");
  });

  it("idempotent when already at target status", () => {
    const stale = evaluateGhost({
      currentGhostStatus: GhostStatus.stale,
      currentState: ApplicationState.applied,
      lastMeaningfulAt: daysAgo(50),
      hasFutureScheduled: false,
      terminal: false,
      now: NOW,
    });
    expect(stale.action).toBe("none");
    expect(stale.nextStatus).toBe(GhostStatus.stale);

    const ghosted = evaluateGhost({
      currentGhostStatus: GhostStatus.possibly_ghosted,
      currentState: ApplicationState.ghosted,
      lastMeaningfulAt: daysAgo(100),
      hasFutureScheduled: false,
      terminal: false,
      now: NOW,
    });
    expect(ghosted.action).toBe("none");
  });
});
