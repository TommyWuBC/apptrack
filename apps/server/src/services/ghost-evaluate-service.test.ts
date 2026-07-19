/**
 * Ghost service contract tests (pure + API shape). Full DB coverage needs Postgres.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateGhost,
  GHOST_VERSION,
  DEFAULT_GHOST_THRESHOLDS,
} from "@apptrack/core";
import { ApplicationState, GhostStatus } from "@apptrack/shared";

describe("ghost-evaluate-service contracts", () => {
  it("exports ghost-v1", () => {
    expect(GHOST_VERSION).toBe("ghost-v1");
    expect(DEFAULT_GHOST_THRESHOLDS.staleAfterDays).toBe(45);
    expect(DEFAULT_GHOST_THRESHOLDS.ghostAfterDays).toBe(90);
  });

  it("pause/reset/dismiss matrix via pure evaluate", () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);

    expect(
      evaluateGhost({
        currentGhostStatus: GhostStatus.none,
        currentState: ApplicationState.interviewing,
        lastMeaningfulAt: ago(100),
        hasFutureScheduled: true,
        terminal: false,
        now,
      }).paused,
    ).toBe(true);

    expect(
      evaluateGhost({
        currentGhostStatus: GhostStatus.stale,
        currentState: ApplicationState.interviewing,
        lastMeaningfulAt: ago(2),
        hasFutureScheduled: false,
        terminal: false,
        now,
      }).action,
    ).toBe("clear");

    expect(
      evaluateGhost({
        currentGhostStatus: GhostStatus.dismissed,
        currentState: ApplicationState.interviewing,
        lastMeaningfulAt: ago(100),
        hasFutureScheduled: false,
        terminal: false,
        dismissedAtState: ApplicationState.interviewing,
        now,
      }).action,
    ).toBe("keep_dismissed");
  });
});
