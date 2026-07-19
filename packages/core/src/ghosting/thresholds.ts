/**
 * Resolve ghost day thresholds with override precedence.
 * company > type > stage > defaults. AGENTS.md §17
 */
import {
  GhostThresholdsV1Schema,
  type GhostDayThresholds,
  type GhostThresholdsV1,
} from "@apptrack/shared";

export const DEFAULT_GHOST_THRESHOLDS: GhostThresholdsV1 = GhostThresholdsV1Schema.parse({
  staleAfterDays: 45,
  ghostAfterDays: 90,
  perStage: {
    final_round: { staleAfterDays: 21, ghostAfterDays: 45 },
    interviewing: { staleAfterDays: 30, ghostAfterDays: 60 },
    recruiter_screen: { staleAfterDays: 30, ghostAfterDays: 60 },
  },
  perType: {
    internship: { staleAfterDays: 30, ghostAfterDays: 60 },
  },
  perCompany: {},
});

export type ResolveThresholdsInput = {
  settings?: Partial<GhostThresholdsV1> | null;
  currentState?: string | null;
  applicationType?: string | null;
  companyId?: string | null;
};

/**
 * Merge user settings over defaults, then apply the most specific override.
 * // AGENTS.md §17
 */
export function resolveGhostThresholds(
  input: ResolveThresholdsInput = {},
): GhostDayThresholds & { source: string } {
  const base = GhostThresholdsV1Schema.parse({
    ...DEFAULT_GHOST_THRESHOLDS,
    ...input.settings,
    perStage: {
      ...DEFAULT_GHOST_THRESHOLDS.perStage,
      ...(input.settings?.perStage ?? {}),
    },
    perType: {
      ...DEFAULT_GHOST_THRESHOLDS.perType,
      ...(input.settings?.perType ?? {}),
    },
    perCompany: {
      ...DEFAULT_GHOST_THRESHOLDS.perCompany,
      ...(input.settings?.perCompany ?? {}),
    },
  });

  let staleAfterDays = base.staleAfterDays;
  let ghostAfterDays = base.ghostAfterDays;
  let source = "default";

  const stage = input.currentState ? base.perStage[input.currentState] : undefined;
  if (stage) {
    staleAfterDays = stage.staleAfterDays;
    ghostAfterDays = stage.ghostAfterDays;
    source = `stage:${input.currentState}`;
  }

  const typeKey = input.applicationType?.toLowerCase().replace(/\s+/g, "_");
  const typeOverride = typeKey ? base.perType[typeKey] : undefined;
  if (typeOverride) {
    staleAfterDays = typeOverride.staleAfterDays;
    ghostAfterDays = typeOverride.ghostAfterDays;
    source = `type:${typeKey}`;
  }

  const companyOverride = input.companyId ? base.perCompany[input.companyId] : undefined;
  if (companyOverride) {
    staleAfterDays = companyOverride.staleAfterDays;
    ghostAfterDays = companyOverride.ghostAfterDays;
    source = `company:${input.companyId}`;
  }

  // Ensure ghost window is always ≥ stale window
  if (ghostAfterDays < staleAfterDays) {
    ghostAfterDays = staleAfterDays;
  }

  return { staleAfterDays, ghostAfterDays, source };
}
