/**
 * Correlation scoring orchestration. AGENTS.md §21 / M16
 */
import {
  CORRELATION_VERSION,
  scoreCorrelation,
  type CorrelationCompanyLocation,
} from "@apptrack/core";
import {
  CorrelationScoreJobV1Schema,
  type CorrelationScoreJobV1,
} from "@apptrack/shared/jobs";
import { repos, type Database } from "@apptrack/db";

function correlationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.CORRELATION_ENABLED ?? "false").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function asLocations(company: {
  hqLocation: unknown;
  officeLocations: unknown;
}): CorrelationCompanyLocation[] {
  const out: CorrelationCompanyLocation[] = [];
  const push = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const o = raw as Record<string, unknown>;
    out.push({
      city: typeof o.city === "string" ? o.city : null,
      region: typeof o.region === "string" ? o.region : null,
      country: typeof o.country === "string" ? o.country : null,
      timezone: typeof o.timezone === "string" ? o.timezone : null,
    });
  };
  push(company.hqLocation);
  if (Array.isArray(company.officeLocations)) {
    for (const loc of company.officeLocations) push(loc);
  }
  return out;
}

function metroKey(loc: CorrelationCompanyLocation): string | null {
  const city = (loc.city ?? "").trim().toLowerCase();
  const region = (loc.region ?? "").trim().toLowerCase();
  if (city) return `city:${city}`;
  if (region) return `region:${region}`;
  return null;
}

function sessionMetro(session: {
  geoCity: string | null;
  geoRegion: string | null;
}): string | null {
  if (session.geoCity) return `city:${session.geoCity.trim().toLowerCase()}`;
  if (session.geoRegion) return `region:${session.geoRegion.trim().toLowerCase()}`;
  return null;
}

export async function runCorrelationScore(
  db: Database,
  rawInput: CorrelationScoreJobV1 = {},
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!correlationEnabled(env)) {
    return {
      enabled: false as const,
      scored: 0,
      inserted: 0,
      skipped: 0,
      algorithmVersion: CORRELATION_VERSION,
    };
  }
  const input = CorrelationScoreJobV1Schema.parse(rawInput);
  const algorithmVersion = input.algorithmVersion ?? CORRELATION_VERSION;

  const user = await repos.usersRepo.getFirstUser(db);
  if (!user) {
    return {
      enabled: true as const,
      scored: 0,
      inserted: 0,
      skipped: 0,
      algorithmVersion,
    };
  }

  const applications = await repos.applicationsRepo.listApplicationsWithCompany(
    db,
    user.id,
  );
  const filteredApps = input.applicationId
    ? applications.filter((app) => app.id === input.applicationId)
    : applications;
  if (filteredApps.length === 0) {
    return {
      enabled: true as const,
      scored: 0,
      inserted: 0,
      skipped: 0,
      algorithmVersion,
    };
  }

  const sessions = input.sessionIds?.length
    ? await repos.analyticsRepo.listSessionsByIds(db, input.sessionIds)
    : await repos.analyticsRepo.listRecentSessions(db, { limit: 200 });

  // Precompute active apps per metro for ambiguity divisor.
  const activeByMetro = new Map<string, number>();
  for (const app of applications) {
    if (["rejected", "withdrawn", "offer"].includes(app.currentState)) continue;
    const company = await repos.applicationsRepo.getCompanyById(db, app.companyId);
    if (!company) continue;
    for (const loc of asLocations(company)) {
      const key = metroKey(loc);
      if (!key) continue;
      activeByMetro.set(key, (activeByMetro.get(key) ?? 0) + 1);
    }
  }

  let scored = 0;
  let inserted = 0;
  let skipped = 0;

  for (const session of sessions) {
    const events = await repos.analyticsRepo.listEventsForSession(db, session.id);
    const sameDayVisitCount = await repos.analyticsRepo.countVisitorSessionsOnUtcDay(
      db,
      session.siteId,
      session.visitorHash,
      session.startedAt,
    );
    const sMetro = sessionMetro(session);

    for (const app of filteredApps) {
      const company = await repos.applicationsRepo.getCompanyById(db, app.companyId);
      if (!company) {
        skipped += 1;
        continue;
      }
      const locations = asLocations(company);
      const eventsForApp = await repos.applicationsRepo.listEventsForApplication(
        db,
        app.id,
      );
      const recentEvents = eventsForApp
        .filter((event) => !event.supersededBy)
        .map((event) => ({
          eventType: event.eventType,
          occurredAt: event.occurredAt,
        }));

      const sharing = sMetro ? (activeByMetro.get(sMetro) ?? 1) : 1;
      const result = scoreCorrelation({
        application: {
          applicationId: app.id,
          appliedAt: app.appliedAt,
          uniqueLinkToken: app.uniqueLinkToken,
          companyName: app.companyName,
          companyLocations: locations,
          recentEvents,
          activeApplicationsSharingMetro: sharing,
        },
        session: {
          sessionId: session.id,
          visitorHash: session.visitorHash,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          referrerHost: session.referrerHost,
          geoCountry: session.geoCountry,
          geoRegion: session.geoRegion,
          geoCity: session.geoCity,
          sameDayVisitCount,
        },
        events: events.map((event) => ({
          eventType: event.eventType,
          path: event.path,
          occurredAt: event.occurredAt,
          srcToken: event.srcToken,
        })),
      });

      if (!result || result.algorithmVersion !== algorithmVersion) {
        skipped += 1;
        continue;
      }
      scored += 1;
      const saved = await repos.correlationRepo.insertPredictionIdempotent(db, {
        applicationId: result.applicationId,
        sessionId: result.sessionId,
        score: result.score,
        confidenceBand: result.confidenceBand,
        deterministic: result.deterministic,
        algorithmVersion: result.algorithmVersion,
        explanation: result.explanation,
        features: result.features.map((feature) => ({
          featureName: feature.featureName,
          featureValue: feature.featureValue,
          weight: feature.weight,
          contribution: feature.contribution,
        })),
      });
      if (saved.inserted) inserted += 1;
    }
  }

  return {
    enabled: true as const,
    scored,
    inserted,
    skipped,
    algorithmVersion,
    sessions: sessions.length,
    applications: filteredApps.length,
  };
}

export { correlationEnabled };
