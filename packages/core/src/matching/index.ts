export { matchApplication, MATCHER_VERSION } from "./match.js";
export type { MatchInput } from "./match.js";
export {
  MATCH_WEIGHTS,
  AUTO_ATTACH_THRESHOLD,
  AUTO_ATTACH_MARGIN,
  REVIEW_FLOOR,
  RECENCY_WINDOW_DAYS,
  TERMINAL_STALE_DAYS,
} from "./weights.js";
export {
  computeSignals,
  clampScore,
  type MatchCandidateContext,
  type MatchEmailContext,
} from "./signals.js";
