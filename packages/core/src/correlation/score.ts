/**
 * Pure correlation scoring v1. AGENTS.md §21.1
 * Rules-based; probabilistic scores hard-capped at medium confidence.
 */
import {
  CorrelationFeatureV1Schema,
  CorrelationResultV1Schema,
  type CorrelationResultV1,
} from "@apptrack/shared";
import { containsBannedCorrelationPhrase } from "./language.js";
import {
  CORRELATION_BAND_LOW_MAX,
  CORRELATION_BAND_NONE_MAX,
  CORRELATION_VERSION,
} from "./version.js";

const MS_PER_DAY = 86_400_000;

export type CorrelationCompanyLocation = {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  timezone?: string | null;
};

export type CorrelationApplicationInput = {
  applicationId: string;
  appliedAt: Date | null;
  uniqueLinkToken?: string | null;
  companyName?: string | null;
  companyLocations: CorrelationCompanyLocation[];
  /** Recent meaningful pipeline events for timing features */
  recentEvents: Array<{ eventType: string; occurredAt: Date }>;
  /** Active applications sharing a metro (for ambiguity divisor) */
  activeApplicationsSharingMetro: number;
};

export type CorrelationSessionInput = {
  sessionId: string;
  visitorHash: string;
  startedAt: Date;
  endedAt?: Date | null;
  referrerHost?: string | null;
  geoCountry?: string | null;
  geoRegion?: string | null;
  geoCity?: string | null;
  /** Same-day visit count for this visitor hash (including this session) */
  sameDayVisitCount: number;
};

export type CorrelationSessionEvent = {
  eventType: string;
  path?: string | null;
  occurredAt: Date;
  srcToken?: string | null;
};

export type ScoreCorrelationInput = {
  application: CorrelationApplicationInput;
  session: CorrelationSessionInput;
  events: CorrelationSessionEvent[];
  now?: Date;
};

const ATS_REFERRER_HOSTS = [
  "linkedin.com",
  "www.linkedin.com",
  "greenhouse.io",
  "lever.co",
  "myworkdayjobs.com",
  "ashbyhq.com",
  "icims.com",
  "smartrecruiters.com",
];

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function bandFor(score: number, deterministic: boolean): "none" | "low" | "medium" | "high" {
  if (deterministic) return "high";
  if (score < CORRELATION_BAND_NONE_MAX) return "none";
  if (score <= CORRELATION_BAND_LOW_MAX) return "low";
  return "medium";
}

function timingPoints(
  sessionStart: Date,
  events: Array<{ eventType: string; occurredAt: Date }>,
): { points: number; detail: string } | null {
  if (events.length === 0) return null;
  let best = 0;
  let bestDetail = "";
  for (const ev of events) {
    const days =
      (sessionStart.getTime() - ev.occurredAt.getTime()) / MS_PER_DAY;
    if (days < 0 || days > 14) continue;
    // Interview invite strongest; others still count.
    const isInterview = /interview/i.test(ev.eventType);
    const peak = isInterview ? 0.25 : 0.2;
    const floor = 0.05;
    const t = days <= 3 ? peak : peak - ((peak - floor) * (days - 3)) / 11;
    if (t > best) {
      best = t;
      bestDetail = `Anonymous visit ${days < 1 ? "within a day" : `${Math.round(days)} days`} after a pipeline event (${ev.eventType.replace(/_/g, " ")})`;
    }
  }
  if (best <= 0) return null;
  return { points: best, detail: bestDetail };
}

function geoMatch(
  session: CorrelationSessionInput,
  locations: CorrelationCompanyLocation[],
): { points: number; name: string; detail: string } | null {
  const city = norm(session.geoCity);
  const region = norm(session.geoRegion);
  if (!city && !region) return null;
  for (const loc of locations) {
    if (city && norm(loc.city) && city === norm(loc.city)) {
      return {
        points: 0.25,
        name: "geo_city_match",
        detail: `Anonymous visit from the ${loc.city} area`,
      };
    }
  }
  for (const loc of locations) {
    if (region && norm(loc.region) && region === norm(loc.region)) {
      return {
        points: 0.12,
        name: "geo_region_match",
        detail: `Anonymous visit from the ${loc.region} region`,
      };
    }
  }
  return null;
}

function businessHoursBonus(
  sessionStart: Date,
  locations: CorrelationCompanyLocation[],
): { points: number; detail: string } | null {
  const tz = locations.find((l) => l.timezone)?.timezone ?? "UTC";
  try {
    const hourStr = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).format(sessionStart);
    const hour = Number.parseInt(hourStr, 10);
    if (Number.isFinite(hour) && hour >= 9 && hour < 18) {
      return {
        points: 0.05,
        detail: "Visit during typical business hours in the company timezone",
      };
    }
  } catch {
    // Invalid tz — skip feature
  }
  return null;
}

function buildExplanation(
  features: Array<{ name: string; detail?: string; contribution: number }>,
  band: string,
  ambiguityK: number,
): string {
  const parts = features
    .filter((f) => f.contribution > 0 && f.detail)
    .map((f) => f.detail!);
  let text =
    parts.length > 0
      ? `${parts.join(". ")}. Possibly related to this application (confidence: ${band}).`
      : `Anonymous visit potentially associated with this application (confidence: ${band}).`;
  if (ambiguityK > 1) {
    text += ` ${ambiguityK} of your active applications share this metro area, which lowers certainty.`;
  }
  // Hard guard — never persist banned phrasing.
  if (containsBannedCorrelationPhrase(text)) {
    return `Anonymous visit potentially associated with this application (confidence: ${band}).`;
  }
  return text;
}

/**
 * Score one (application, session) pair. AGENTS.md §21.1
 */
export function scoreCorrelation(input: ScoreCorrelationInput): CorrelationResultV1 | null {
  const { application, session, events } = input;
  if (application.appliedAt && session.startedAt < application.appliedAt) {
    return null;
  }

  // Deterministic path: unique link token on any session event.
  const token = application.uniqueLinkToken?.trim();
  if (token) {
    const hit = events.some((e) => e.srcToken && e.srcToken === token);
    if (hit) {
      const explanation =
        "Visit used this application's unique link. Estimated association is deterministic for this session.";
      return CorrelationResultV1Schema.parse({
        applicationId: application.applicationId,
        sessionId: session.sessionId,
        score: 1,
        confidenceBand: "high",
        deterministic: true,
        algorithmVersion: CORRELATION_VERSION,
        explanation,
        features: [
          CorrelationFeatureV1Schema.parse({
            featureName: "unique_link_token",
            featureValue: { matched: true },
            weight: 1,
            contribution: 1,
          }),
        ],
      });
    }
  }

  const features: Array<{
    featureName: string;
    featureValue: Record<string, unknown>;
    weight: number;
    contribution: number;
    detail?: string;
  }> = [];

  const timing = timingPoints(session.startedAt, application.recentEvents);
  if (timing) {
    features.push({
      featureName: "event_timing",
      featureValue: { points: timing.points },
      weight: timing.points,
      contribution: timing.points,
      detail: timing.detail,
    });
  }

  const geo = geoMatch(session, application.companyLocations);
  if (geo) {
    features.push({
      featureName: geo.name,
      featureValue: {
        city: session.geoCity,
        region: session.geoRegion,
      },
      weight: geo.points,
      contribution: geo.points,
      detail: geo.detail,
    });
  }

  const referrer = norm(session.referrerHost);
  if (referrer && ATS_REFERRER_HOSTS.some((h) => referrer === h || referrer.endsWith(`.${h}`))) {
    features.push({
      featureName: "referrer_ats_or_linkedin",
      featureValue: { host: session.referrerHost },
      weight: 0.1,
      contribution: 0.1,
      detail: "Referrer looks like LinkedIn or an ATS domain",
    });
  }

  const hasResume = events.some(
    (e) =>
      (e.eventType === "resume_view" || e.eventType === "resume_download") &&
      (!e.srcToken || e.srcToken !== token),
  );
  if (hasResume) {
    features.push({
      featureName: "resume_engagement",
      featureValue: { matched: true },
      weight: 0.15,
      contribution: 0.15,
      detail: "Anonymous visit included a résumé view or download",
    });
  }

  const hasProject = events.some(
    (e) => e.eventType === "project_view" || (e.path ?? "").includes("/project"),
  );
  if (hasProject) {
    features.push({
      featureName: "project_views",
      featureValue: { matched: true },
      weight: 0.05,
      contribution: 0.05,
      detail: "Project pages were viewed in this anonymous session",
    });
  }

  if (session.sameDayVisitCount >= 2) {
    features.push({
      featureName: "repeat_visitor_same_day",
      featureValue: { count: session.sameDayVisitCount },
      weight: 0.05,
      contribution: 0.05,
      detail: "Repeat anonymous visits the same day",
    });
  }

  const hours = businessHoursBonus(session.startedAt, application.companyLocations);
  if (hours) {
    features.push({
      featureName: "business_hours",
      featureValue: { matched: true },
      weight: 0.05,
      contribution: 0.05,
      detail: hours.detail,
    });
  }

  const raw = features.reduce((sum, f) => sum + f.contribution, 0);
  const k = Math.max(1, application.activeApplicationsSharingMetro);
  const ambiguityDivisor = Math.sqrt(k);
  let score = clamp01(raw / ambiguityDivisor);
  // Probabilistic hard-cap at medium band ceiling (just below needing "high").
  if (score > CORRELATION_BAND_LOW_MAX + 0.2) {
    // Still medium; cap display score so high is impossible without deterministic.
    score = Math.min(score, 0.85);
  }
  const confidenceBand = bandFor(score, false);
  if (confidenceBand === "none") return null;

  if (k > 1) {
    features.push({
      featureName: "ambiguity_divisor",
      featureValue: { k, divisor: ambiguityDivisor },
      weight: 0,
      contribution: 0,
      detail: undefined,
    });
  }

  const explanation = buildExplanation(
    features.map((f) => ({
      name: f.featureName,
      detail: f.detail,
      contribution: f.contribution,
    })),
    confidenceBand,
    k,
  );

  return CorrelationResultV1Schema.parse({
    applicationId: application.applicationId,
    sessionId: session.sessionId,
    score,
    confidenceBand,
    deterministic: false,
    algorithmVersion: CORRELATION_VERSION,
    explanation,
    features: features.map((f) =>
      CorrelationFeatureV1Schema.parse({
        featureName: f.featureName,
        featureValue: f.featureValue,
        weight: f.weight,
        contribution: f.contribution,
      }),
    ),
  });
}
