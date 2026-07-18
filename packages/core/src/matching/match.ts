/**
 * Application matcher. AGENTS.md §15
 * Pure: data in → MatchResultV1 out. Persistence lives in apps/server.
 */
import {
  EventType,
  MatchDecision,
  MatchResultV1Schema,
  type MatchResultV1,
} from "@apptrack/shared";
import {
  clampScore,
  computeSignals,
  type MatchCandidateContext,
  type MatchEmailContext,
} from "./signals.js";
import { MATCHER_VERSION } from "./version.js";
import {
  AUTO_ATTACH_MARGIN,
  AUTO_ATTACH_THRESHOLD,
  REVIEW_FLOOR,
} from "./weights.js";

export type MatchInput = {
  email: MatchEmailContext;
  candidates: MatchCandidateContext[];
};

/**
 * Score candidates and apply §15.2 thresholds.
 * // AGENTS.md §15.2
 */
export function matchApplication(input: MatchInput): MatchResultV1 {
  const scored = input.candidates.map((c) => {
    const { signals, rawScore } = computeSignals(input.email, c);
    return {
      applicationId: c.applicationId,
      score: clampScore(rawScore),
      signals,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.applicationId.localeCompare(b.applicationId);
  });

  const top = scored[0];
  const runner = scored[1];
  const topScore = top?.score ?? 0;
  const margin = top ? topScore - (runner?.score ?? 0) : 0;

  let decision: MatchResultV1["decision"];
  let selectedApplicationId: string | null = null;
  let reason: string;

  if (!top || topScore < REVIEW_FLOOR) {
    if (input.email.eventType === EventType.application_confirmation) {
      decision = MatchDecision.new_application;
      reason =
        "Score below review floor; application_confirmation creates a new application";
    } else if (!top) {
      decision = MatchDecision.review;
      reason = "No candidate applications at resolved company";
    } else {
      decision = MatchDecision.review;
      reason = `Top score ${topScore.toFixed(2)} below review floor ${REVIEW_FLOOR}`;
    }
  } else if (
    topScore >= AUTO_ATTACH_THRESHOLD &&
    margin >= AUTO_ATTACH_MARGIN
  ) {
    decision = MatchDecision.auto_attached;
    selectedApplicationId = top.applicationId;
    reason = `Score ${topScore.toFixed(2)} with margin ${margin.toFixed(2)} — auto-attach`;
  } else {
    decision = MatchDecision.review;
    selectedApplicationId = top.applicationId;
    reason =
      topScore >= AUTO_ATTACH_THRESHOLD && margin < AUTO_ATTACH_MARGIN
        ? `Score ${topScore.toFixed(2)} but margin ${margin.toFixed(2)} < ${AUTO_ATTACH_MARGIN}`
        : `Score ${topScore.toFixed(2)} in ambiguous band [${REVIEW_FLOOR}, ${AUTO_ATTACH_THRESHOLD})`;
  }

  const result: MatchResultV1 = {
    matcherVersion: MATCHER_VERSION,
    decision,
    selectedApplicationId,
    score: topScore,
    margin,
    candidates: scored,
    reason,
  };

  return MatchResultV1Schema.parse(result);
}

export {
  MATCHER_VERSION,
  AUTO_ATTACH_THRESHOLD,
  AUTO_ATTACH_MARGIN,
  REVIEW_FLOOR,
};
