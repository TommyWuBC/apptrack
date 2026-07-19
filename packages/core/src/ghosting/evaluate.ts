/**
 * Pure ghost inference. AGENTS.md §17
 * Does not write DB — returns the desired status transition + evidence.
 */
import {
  GhostEvaluateResultV1Schema,
  GhostStatus,
  type GhostEvaluateResultV1,
  type GhostThresholdsV1,
} from "@apptrack/shared";
import { resolveGhostThresholds } from "./thresholds.js";
import { GHOST_VERSION } from "./version.js";

const MS_PER_DAY = 86_400_000;

export type GhostEvaluateInput = {
  currentGhostStatus: string;
  currentState: string;
  /** Last meaningful event time from reducer ghostInputs */
  lastMeaningfulAt: Date | null;
  /** Fallback when no meaningful events yet (e.g. applied_at) */
  appliedAt?: Date | null;
  hasFutureScheduled: boolean;
  terminal: boolean;
  /**
   * Application state when user dismissed ghosting.
   * Re-flagging is suppressed until currentState differs. §17
   */
  dismissedAtState?: string | null;
  now?: Date;
  settings?: Partial<GhostThresholdsV1> | null;
  applicationType?: string | null;
  companyId?: string | null;
};

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function asStatus(raw: string): string {
  if (
    raw === GhostStatus.stale ||
    raw === GhostStatus.possibly_ghosted ||
    raw === GhostStatus.dismissed
  ) {
    return raw;
  }
  return GhostStatus.none;
}

/**
 * Evaluate whether an application should be stale / possibly ghosted / cleared.
 * // AGENTS.md §17
 */
export function evaluateGhost(
  input: GhostEvaluateInput,
): GhostEvaluateResultV1 {
  const now = input.now ?? new Date();
  const current = asStatus(input.currentGhostStatus);
  const anchor = input.lastMeaningfulAt ?? input.appliedAt ?? null;
  const daysInactive = anchor ? daysBetween(anchor, now) : null;

  const thresholds = resolveGhostThresholds({
    settings: input.settings,
    currentState: input.currentState,
    applicationType: input.applicationType,
    companyId: input.companyId,
  });

  // Terminal states never ghost (offer / rejected / withdrawn).
  if (input.terminal) {
    if (current === GhostStatus.none) {
      return GhostEvaluateResultV1Schema.parse({
        nextStatus: GhostStatus.none,
        action: "none",
        daysInactive,
        paused: false,
        evidence: "Terminal state — ghost timer inactive",
        algorithmVersion: GHOST_VERSION,
      });
    }
    return GhostEvaluateResultV1Schema.parse({
      nextStatus: GhostStatus.none,
      action: "clear",
      daysInactive,
      paused: false,
      evidence: "Terminal state — clearing ghost inference",
      algorithmVersion: GHOST_VERSION,
    });
  }

  // User dismissal suppresses until state changes.
  if (current === GhostStatus.dismissed) {
    const dismissedAt = input.dismissedAtState ?? null;
    if (dismissedAt === null || dismissedAt === input.currentState) {
      return GhostEvaluateResultV1Schema.parse({
        nextStatus: GhostStatus.dismissed,
        action: "keep_dismissed",
        daysInactive,
        paused: false,
        evidence:
          "User dismissed ghosting — suppressed until application state changes",
        algorithmVersion: GHOST_VERSION,
      });
    }
    // State changed after dismiss → fall through as if none
  }

  // Timer pauses while a future interview / OA deadline exists.
  if (input.hasFutureScheduled) {
    return GhostEvaluateResultV1Schema.parse({
      nextStatus:
        current === GhostStatus.dismissed ? GhostStatus.none : current,
      action:
        current === GhostStatus.dismissed &&
        input.dismissedAtState !== input.currentState
          ? "clear"
          : "none",
      daysInactive,
      paused: true,
      evidence:
        "Ghost timer paused — future interview or assessment deadline scheduled",
      algorithmVersion: GHOST_VERSION,
    });
  }

  // No activity anchor yet — do not infer.
  if (daysInactive === null) {
    return GhostEvaluateResultV1Schema.parse({
      nextStatus: GhostStatus.none,
      action: current === GhostStatus.none ? "none" : "clear",
      daysInactive: null,
      paused: false,
      evidence: "No meaningful activity timestamp — cannot evaluate ghosting",
      algorithmVersion: GHOST_VERSION,
    });
  }

  // Within stale window → clear any prior inference (activity resets timer).
  if (daysInactive < thresholds.staleAfterDays) {
    if (
      current === GhostStatus.stale ||
      current === GhostStatus.possibly_ghosted ||
      (current === GhostStatus.dismissed &&
        input.dismissedAtState !== input.currentState)
    ) {
      return GhostEvaluateResultV1Schema.parse({
        nextStatus: GhostStatus.none,
        action: "clear",
        daysInactive,
        paused: false,
        evidence: `Activity within ${thresholds.staleAfterDays}d stale window (${daysInactive}d inactive) — clearing ghost status`,
        algorithmVersion: GHOST_VERSION,
      });
    }
    return GhostEvaluateResultV1Schema.parse({
      nextStatus: GhostStatus.none,
      action: "none",
      daysInactive,
      paused: false,
      evidence: `${daysInactive}d inactive (< ${thresholds.staleAfterDays}d stale / ${thresholds.ghostAfterDays}d ghost; ${thresholds.source})`,
      algorithmVersion: GHOST_VERSION,
    });
  }

  // Past ghost threshold → possibly_ghosted
  if (daysInactive >= thresholds.ghostAfterDays) {
    if (current === GhostStatus.possibly_ghosted) {
      return GhostEvaluateResultV1Schema.parse({
        nextStatus: GhostStatus.possibly_ghosted,
        action: "none",
        daysInactive,
        paused: false,
        evidence: `Already possibly ghosted (${daysInactive}d inactive ≥ ${thresholds.ghostAfterDays}d; ${thresholds.source})`,
        algorithmVersion: GHOST_VERSION,
      });
    }
    return GhostEvaluateResultV1Schema.parse({
      nextStatus: GhostStatus.possibly_ghosted,
      action: "mark_ghosted",
      daysInactive,
      paused: false,
      evidence: `No activity for ${daysInactive} days (≥ ${thresholds.ghostAfterDays}d ghost threshold; ${thresholds.source}) — possibly ghosted`,
      algorithmVersion: GHOST_VERSION,
    });
  }

  // Between stale and ghost → stale
  if (current === GhostStatus.stale) {
    return GhostEvaluateResultV1Schema.parse({
      nextStatus: GhostStatus.stale,
      action: "none",
      daysInactive,
      paused: false,
      evidence: `Already stale (${daysInactive}d inactive; threshold ${thresholds.staleAfterDays}/${thresholds.ghostAfterDays}; ${thresholds.source})`,
      algorithmVersion: GHOST_VERSION,
    });
  }

  // Was possibly_ghosted but now only in stale window? Keep possibly_ghosted
  // until cleared by activity (don't silently demote without clear event).
  if (current === GhostStatus.possibly_ghosted) {
    return GhostEvaluateResultV1Schema.parse({
      nextStatus: GhostStatus.possibly_ghosted,
      action: "none",
      daysInactive,
      paused: false,
      evidence: `Still possibly ghosted (${daysInactive}d inactive; ${thresholds.source})`,
      algorithmVersion: GHOST_VERSION,
    });
  }

  return GhostEvaluateResultV1Schema.parse({
    nextStatus: GhostStatus.stale,
    action: "mark_stale",
    daysInactive,
    paused: false,
    evidence: `No activity for ${daysInactive} days (≥ ${thresholds.staleAfterDays}d stale threshold; ${thresholds.source}) — marked stale`,
    algorithmVersion: GHOST_VERSION,
  });
}
