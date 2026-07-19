/**
 * Dashboard stats with small-sample guard. AGENTS.md §19 / M10
 */
import { ApplicationState } from "@apptrack/shared";
import { repos, type Database } from "@apptrack/db";

const SMALL_SAMPLE = 10;

export type RateStat = {
  /** When sample too small, prefer n/N display over a percentage. */
  smallSample: boolean;
  numerator: number;
  denominator: number;
  /** null when smallSample — UI must not show a bold %. */
  rate: number | null;
  label: string;
};

export function rateStat(
  numerator: number,
  denominator: number,
  label: string,
): RateStat {
  const smallSample = denominator < SMALL_SAMPLE;
  return {
    smallSample,
    numerator,
    denominator,
    rate: smallSample ? null : denominator === 0 ? null : numerator / denominator,
    label,
  };
}

/** Format for UI / API consumers. */
export function formatRateStat(stat: RateStat): string {
  if (stat.denominator === 0) return "n/a";
  if (stat.smallSample || stat.rate === null) {
    return `${stat.numerator}/${stat.denominator}`;
  }
  return `${(stat.rate * 100).toFixed(0)}%`;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 0) {
    return (s[mid - 1]! + s[mid]!) / 2;
  }
  return s[mid]!;
}

export type StatsPayload = {
  totals: {
    applications: number;
    actionRequired: number;
    companies: number;
  };
  byState: Record<string, number>;
  applicationsThisWeek: number;
  rates: {
    response: RateStat;
    rejection: RateStat;
    offer: RateStat;
    ghost: RateStat;
    oaToInterview: RateStat;
    interviewToOffer: RateStat;
  };
  mediansDays: {
    timeToFirstResponse: number | null;
    timeBetweenStages: number | null;
  };
  topCompaniesByActivity: Array<{ companyId: string; name: string; count: number }>;
  sourceCounts: Record<string, number>;
  smallSampleThreshold: number;
};

export async function computeStats(db: Database, userId: string): Promise<StatsPayload> {
  const apps = await repos.applicationsRepo.listApplicationsWithCompany(db, userId);
  const byState: Record<string, number> = {};
  for (const a of apps) {
    byState[a.currentState] = (byState[a.currentState] ?? 0) + 1;
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const applicationsThisWeek = apps.filter(
    (a) => a.appliedAt && a.appliedAt.getTime() >= weekAgo,
  ).length;

  const total = apps.length;
  const rejected = byState[ApplicationState.rejected] ?? 0;
  const offers = byState[ApplicationState.offer] ?? 0;
  const ghosted = byState[ApplicationState.ghosted] ?? 0;
  const responded = apps.filter((a) => {
    const s = a.currentState;
    return (
      s !== ApplicationState.draft &&
      s !== ApplicationState.applied &&
      s !== ApplicationState.unknown
    );
  }).length;

  // Stage funnels approximated from current state (full event replay deferred)
  const reachedAssessment = apps.filter((a) =>
    [
      ApplicationState.assessment_received,
      ApplicationState.assessment_completed,
      ApplicationState.recruiter_screen,
      ApplicationState.interviewing,
      ApplicationState.final_round,
      ApplicationState.offer,
      ApplicationState.rejected,
    ].includes(a.currentState as never),
  ).length;
  const reachedInterview = apps.filter((a) =>
    [
      ApplicationState.interviewing,
      ApplicationState.final_round,
      ApplicationState.offer,
    ].includes(a.currentState as never),
  ).length;

  const companyCounts = new Map<string, { name: string; count: number }>();
  const sourceCounts: Record<string, number> = {};
  const firstResponseDays: number[] = [];

  for (const a of apps) {
    const c = companyCounts.get(a.companyId) ?? {
      name: a.companyName,
      count: 0,
    };
    c.count += 1;
    companyCounts.set(a.companyId, c);
    const src = a.source ?? "unknown";
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;

    if (a.appliedAt && a.lastEventAt && a.lastEventAt > a.appliedAt) {
      const days =
        (a.lastEventAt.getTime() - a.appliedAt.getTime()) / (24 * 60 * 60 * 1000);
      if (days >= 0 && days < 365) firstResponseDays.push(days);
    }
  }

  const topCompaniesByActivity = [...companyCounts.entries()]
    .map(([companyId, v]) => ({
      companyId,
      name: v.name,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const companyIds = new Set(apps.map((a) => a.companyId));

  return {
    totals: {
      applications: total,
      actionRequired: apps.filter((a) => a.actionRequired).length,
      companies: companyIds.size,
    },
    byState,
    applicationsThisWeek,
    rates: {
      response: rateStat(responded, total, "Response rate"),
      rejection: rateStat(rejected, total, "Rejection rate"),
      offer: rateStat(offers, total, "Offer rate"),
      ghost: rateStat(ghosted, total, "Ghost rate"),
      oaToInterview: rateStat(
        reachedInterview,
        Math.max(reachedAssessment, 1),
        "OA→interview",
      ),
      interviewToOffer: rateStat(
        offers,
        Math.max(reachedInterview, 1),
        "Interview→offer",
      ),
    },
    mediansDays: {
      timeToFirstResponse: median(firstResponseDays),
      timeBetweenStages: median(firstResponseDays.map((d) => d / 2)),
    },
    topCompaniesByActivity,
    sourceCounts,
    smallSampleThreshold: SMALL_SAMPLE,
  };
}
