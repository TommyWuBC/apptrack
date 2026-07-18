/**
 * Match signal weights. AGENTS.md §15.1
 * Sum is clamped to [0, 1] after aggregation.
 */
export const MATCH_WEIGHTS = {
  sameThread: 0.95,
  requisitionOrUrl: 0.9,
  portalUrl: 0.8,
  recruiterSender: 0.5,
  roleTitleSimilarity: 0.4,
  assessmentContinuity: 0.4,
  locationMatch: 0.2,
  recencyPrior: 0.2,
  stateCompatibility: 0.3,
  terminalPenalty: -0.4,
} as const;

export type MatchWeightKey = keyof typeof MATCH_WEIGHTS;

/** Auto-attach when score ≥ this and margin ≥ AUTO_ATTACH_MARGIN. §15.2 */
export const AUTO_ATTACH_THRESHOLD = 0.75;
export const AUTO_ATTACH_MARGIN = 0.2;
/** Below this → new_application (if confirmation) or unmatched review. */
export const REVIEW_FLOOR = 0.45;
/** Recency prior window in days. */
export const RECENCY_WINDOW_DAYS = 45;
/** Terminal-state penalty applies when last activity older than this. */
export const TERMINAL_STALE_DAYS = 30;
