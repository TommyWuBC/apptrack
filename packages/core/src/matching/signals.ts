/**
 * Individual match signals. AGENTS.md §15.1
 */
import { EventType } from "@apptrack/shared";
import { roleTitleSimilarity } from "../resolution/normalize-role.js";
import { MATCH_WEIGHTS, RECENCY_WINDOW_DAYS, TERMINAL_STALE_DAYS } from "./weights.js";
import type { MatchSignal } from "@apptrack/shared";

const TERMINAL_STATES = new Set(["offer", "rejected", "withdrawn", "ghosted"]);

/** Event types that fit assessment_received stage. */
const ASSESSMENT_EVENTS = new Set<string>([
  EventType.oa_invitation,
  EventType.oa_reminder,
]);

/** Event types that fit interviewing stages. */
const INTERVIEW_EVENTS = new Set<string>([
  EventType.interview_invitation,
  EventType.interview_scheduled,
  EventType.interview_rescheduled,
  EventType.recruiter_outreach,
]);

export type MatchCandidateContext = {
  applicationId: string;
  currentState: string;
  lastEventAt: Date | null;
  appliedAt: Date | null;
  roleTitle?: string | null;
  requisitionId?: string | null;
  postingUrl?: string | null;
  portalUrl?: string | null;
  locationText?: string | null;
  recruiterEmails?: string[];
  assessmentProviders?: string[];
  /** True when an already-attached email shares this Gmail thread. */
  sameThread: boolean;
};

export type MatchEmailContext = {
  eventType: string;
  occurredAt: Date;
  fromAddress?: string | null;
  roleTitle?: string | null;
  requisitionId?: string | null;
  jobPostingUrl?: string | null;
  portalUrl?: string | null;
  locationText?: string | null;
  recruiterEmail?: string | null;
  assessmentProvider?: string | null;
};

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000);
}

function normalizeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return `${url.host.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return u.toLowerCase().replace(/\/$/, "");
  }
}

function extractReqTokens(...values: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    const matches = v.match(/\b(?:R[-_]?\d{4,}|JR\d{5,}|REQ[-_]?\d{3,}|\d{6,})\b/gi);
    for (const m of matches ?? []) out.add(m.toUpperCase());
    // Greenhouse/Lever path ids
    const pathIds = v.match(/\/(?:jobs|job)\/([a-zA-Z0-9_-]{6,})/g);
    for (const p of pathIds ?? []) {
      const id = p.split("/").pop();
      if (id) out.add(id.toUpperCase());
    }
  }
  return out;
}

function signal(
  name: string,
  weight: number,
  fired: boolean,
  detail?: string,
): MatchSignal {
  return {
    name,
    weight,
    fired,
    contribution: fired ? weight : 0,
    detail,
  };
}

/**
 * Score one application candidate against the incoming email.
 * Returns signals + clamped raw sum (may exceed 1 before clamp in caller).
 */
export function computeSignals(
  email: MatchEmailContext,
  candidate: MatchCandidateContext,
): { signals: MatchSignal[]; rawScore: number } {
  const signals: MatchSignal[] = [];

  // Same Gmail thread
  signals.push(
    signal(
      "sameThread",
      MATCH_WEIGHTS.sameThread,
      candidate.sameThread,
      candidate.sameThread ? "Shares Gmail thread with attached email" : undefined,
    ),
  );

  // Requisition ID / job URL / candidate-ID token
  const emailTokens = extractReqTokens(
    email.requisitionId,
    email.jobPostingUrl,
    email.portalUrl,
  );
  const candTokens = extractReqTokens(
    candidate.requisitionId,
    candidate.postingUrl,
    candidate.portalUrl,
  );
  let reqHit = false;
  let reqDetail: string | undefined;
  for (const t of emailTokens) {
    if (candTokens.has(t)) {
      reqHit = true;
      reqDetail = `Shared token ${t}`;
      break;
    }
  }
  signals.push(
    signal("requisitionOrUrl", MATCH_WEIGHTS.requisitionOrUrl, reqHit, reqDetail),
  );

  // Unique portal URL
  const portalA = normalizeUrl(email.portalUrl);
  const portalB = normalizeUrl(candidate.portalUrl);
  const portalHit = Boolean(portalA && portalB && portalA === portalB);
  signals.push(
    signal(
      "portalUrl",
      MATCH_WEIGHTS.portalUrl,
      portalHit,
      portalHit ? "Portal URL match" : undefined,
    ),
  );

  // Same recruiter sender
  const from = (email.fromAddress ?? email.recruiterEmail ?? "").toLowerCase().trim();
  const recruiterHit =
    from.length > 0 &&
    (candidate.recruiterEmails ?? []).some((e) => e.toLowerCase() === from);
  signals.push(
    signal(
      "recruiterSender",
      MATCH_WEIGHTS.recruiterSender,
      recruiterHit,
      recruiterHit ? `Recruiter ${from}` : undefined,
    ),
  );

  // Role title similarity (proportional contribution)
  const titleSim =
    email.roleTitle && candidate.roleTitle
      ? roleTitleSimilarity(email.roleTitle, candidate.roleTitle)
      : 0;
  const titleContrib = titleSim * MATCH_WEIGHTS.roleTitleSimilarity;
  signals.push({
    name: "roleTitleSimilarity",
    weight: MATCH_WEIGHTS.roleTitleSimilarity,
    fired: titleSim >= 0.34,
    contribution: titleContrib,
    detail: titleSim > 0 ? `Title similarity ${(titleSim * 100).toFixed(0)}%` : undefined,
  });

  // Assessment provider continuity
  const assessHit =
    Boolean(email.assessmentProvider) &&
    (candidate.assessmentProviders ?? []).some(
      (p) => p.toLowerCase() === email.assessmentProvider!.toLowerCase(),
    );
  signals.push(
    signal(
      "assessmentContinuity",
      MATCH_WEIGHTS.assessmentContinuity,
      assessHit,
      assessHit ? `Assessment provider ${email.assessmentProvider}` : undefined,
    ),
  );

  // Location match (simple normalized string equality / containment)
  const locA = (email.locationText ?? "").toLowerCase().trim();
  const locB = (candidate.locationText ?? "").toLowerCase().trim();
  const locHit =
    locA.length > 0 &&
    locB.length > 0 &&
    (locA === locB || locA.includes(locB) || locB.includes(locA));
  signals.push(
    signal(
      "locationMatch",
      MATCH_WEIGHTS.locationMatch,
      locHit,
      locHit ? "Location overlap" : undefined,
    ),
  );

  // Recency prior (decays linearly over RECENCY_WINDOW_DAYS)
  const anchor = candidate.lastEventAt ?? candidate.appliedAt;
  let recencyContrib = 0;
  let recencyFired = false;
  if (anchor) {
    const days = daysBetween(email.occurredAt, anchor);
    if (days <= RECENCY_WINDOW_DAYS) {
      recencyFired = true;
      recencyContrib = MATCH_WEIGHTS.recencyPrior * (1 - days / RECENCY_WINDOW_DAYS);
    }
  }
  signals.push({
    name: "recencyPrior",
    weight: MATCH_WEIGHTS.recencyPrior,
    fired: recencyFired,
    contribution: recencyContrib,
    detail: recencyFired ? "Within activity window" : undefined,
  });

  // State compatibility
  const state = candidate.currentState;
  let stateOk = false;
  let stateDetail: string | undefined;
  if (ASSESSMENT_EVENTS.has(email.eventType)) {
    stateOk =
      state === "applied" ||
      state === "confirmation_received" ||
      state === "assessment_received";
    if (stateOk) stateDetail = `${email.eventType} fits ${state}`;
  } else if (INTERVIEW_EVENTS.has(email.eventType)) {
    stateOk =
      state === "assessment_received" ||
      state === "assessment_completed" ||
      state === "recruiter_screen" ||
      state === "interviewing" ||
      state === "confirmation_received" ||
      state === "applied";
    if (stateOk) stateDetail = `${email.eventType} fits ${state}`;
  } else if (email.eventType === EventType.rejection) {
    stateOk = !TERMINAL_STATES.has(state) || state === "offer";
  } else if (email.eventType === EventType.offer) {
    stateOk = state !== "withdrawn";
  } else if (email.eventType === EventType.application_confirmation) {
    stateOk = state === "draft" || state === "applied" || state === "unknown";
  } else {
    stateOk = !TERMINAL_STATES.has(state);
  }
  signals.push(
    signal("stateCompatibility", MATCH_WEIGHTS.stateCompatibility, stateOk, stateDetail),
  );

  // Negative: terminal + stale
  let terminalPenalty = false;
  if (TERMINAL_STATES.has(state) && anchor) {
    const days = daysBetween(email.occurredAt, anchor);
    if (days > TERMINAL_STALE_DAYS) {
      terminalPenalty = true;
    }
  }
  signals.push(
    signal(
      "terminalPenalty",
      MATCH_WEIGHTS.terminalPenalty,
      terminalPenalty,
      terminalPenalty
        ? `Application already ${state} >${TERMINAL_STALE_DAYS}d`
        : undefined,
    ),
  );

  const rawScore = signals.reduce((s, x) => s + x.contribution, 0);
  return { signals, rawScore };
}

/** Clamp score to [0, 1]. */
export function clampScore(raw: number): number {
  return Math.max(0, Math.min(1, raw));
}
