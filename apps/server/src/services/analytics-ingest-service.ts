/**
 * Analytics ingest + aggregate + retention. AGENTS.md §20 / §23 / M14
 */
import {
  ANALYTICS_RETENTION_DAYS_DEFAULT,
  ANALYTICS_SESSION_IDLE_MS,
  computeVisitorHash,
  dailyVisitorSalt,
  parseCoarseUa,
  referrerHostFromProps,
  sessionizeEvents,
  utmFromProps,
} from "@apptrack/core";
import {
  AnalyticsIngestBatchV1Schema,
  AnalyticsSiteMode,
  type AnalyticsIngestBatchV1,
} from "@apptrack/shared";
import { repos, type Database } from "@apptrack/db";
import { resolveGeo, type GeoLookup } from "./geo-lookup.js";
import { siteKeyLimiter, sourceLimiter } from "./rate-limit.js";
import { createHash } from "node:crypto";

const MAX_BODY_BYTES = 8 * 1024;

function secretForSalt(): string {
  return (
    process.env.APP_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    "dev-analytics-salt"
  );
}

function hashSource(ip: string): string {
  return createHash("sha256").update(`rl|${ip}`).digest("hex").slice(0, 16);
}

export function originAllowed(
  origin: string | undefined,
  allowlist: string[],
): boolean {
  if (!origin) return allowlist.length === 0;
  if (allowlist.length === 0) return true; // open until configured (dev)
  try {
    const o = new URL(origin).origin;
    return allowlist.some((a) => {
      try {
        return new URL(a).origin === o;
      } catch {
        return a === origin || a === o;
      }
    });
  } catch {
    return allowlist.includes(origin);
  }
}

export type IngestContext = {
  ip: string;
  userAgent?: string;
  origin?: string;
  headers?: Record<string, string | string[] | undefined>;
  bodyBytes: number;
  now?: Date;
  geoLookup?: GeoLookup | null;
};

export type IngestResult = {
  accepted: number;
  duplicates: number;
  siteId: string;
  mode: string;
};

/**
 * Public ingest: validate → rate-limit → hash+geo in memory → insert → return.
 * IP is not written anywhere. AGENTS.md §20.4 / INV-8 / NFR-2
 */
export async function ingestAnalyticsBatch(
  db: Database,
  rawBody: unknown,
  ctx: IngestContext,
): Promise<IngestResult> {
  if (ctx.bodyBytes > MAX_BODY_BYTES) {
    throw Object.assign(new Error("payload_too_large"), { statusCode: 413 });
  }

  const parsed = AnalyticsIngestBatchV1Schema.safeParse(rawBody);
  if (!parsed.success) {
    throw Object.assign(new Error("validation_error"), {
      statusCode: 400,
      details: parsed.error.flatten(),
    });
  }
  const batch: AnalyticsIngestBatchV1 = parsed.data;

  const site = await repos.analyticsRepo.getSiteByKey(db, batch.siteKey);
  if (!site) {
    throw Object.assign(new Error("site_not_found"), { statusCode: 401 });
  }
  if (site.mode === AnalyticsSiteMode.off) {
    throw Object.assign(new Error("site_off"), { statusCode: 403 });
  }

  if (!originAllowed(ctx.origin, site.originAllowlist ?? [])) {
    throw Object.assign(new Error("origin_not_allowed"), { statusCode: 403 });
  }

  if (!siteKeyLimiter.allow(site.siteKey)) {
    throw Object.assign(new Error("rate_limited"), { statusCode: 429 });
  }
  const sourceKey = hashSource(ctx.ip || "unknown");
  if (!sourceLimiter.allow(sourceKey)) {
    throw Object.assign(new Error("rate_limited"), { statusCode: 429 });
  }

  const now = ctx.now ?? new Date();
  const ua = parseCoarseUa(ctx.userAgent);
  const salt = dailyVisitorSalt(secretForSalt(), now);
  // Compute hash then drop IP from further use (INV-8)
  const visitorHash = computeVisitorHash({
    dailySalt: salt,
    siteKey: site.siteKey,
    ip: ctx.ip || "0.0.0.0",
    uaFamily: ua.browserFamily,
  });

  const geo = resolveGeo({
    mode: site.mode,
    headers: ctx.headers,
    ip: ctx.ip,
    lookup: ctx.geoLookup,
  });
  // IP must not appear in any persisted structure below.

  let accepted = 0;
  let duplicates = 0;
  for (const ev of batch.events) {
    const props = (ev.props ?? {}) as Record<string, unknown>;
    const { inserted } = await repos.analyticsRepo.insertEventIdempotent(db, {
      eventId: ev.eventId,
      siteId: site.id,
      visitorHash,
      eventType: ev.eventType,
      path: ev.path,
      occurredAt: ev.occurredAt,
      props,
      srcToken: ev.srcToken,
      referrerHost: referrerHostFromProps(props),
      deviceCategory: ua.deviceCategory,
      browserFamily: ua.browserFamily,
      geoCountry: geo.country,
      geoRegion: geo.region,
      geoCity: geo.city,
    });
    if (inserted) accepted += 1;
    else duplicates += 1;
  }

  return { accepted, duplicates, siteId: site.id, mode: site.mode };
}

/**
 * Sessionize unsessionized events into 30-min windows. AGENTS.md §20.4 / §23
 */
export async function aggregateAnalyticsSessions(
  db: Database,
  opts: { now?: Date; idleMs?: number } = {},
) {
  const now = opts.now ?? new Date();
  const idleMs = opts.idleMs ?? ANALYTICS_SESSION_IDLE_MS;
  const rows = await repos.analyticsRepo.listUnsessionizedEvents(db, {
    limit: 5000,
  });

  // Group by site + visitor
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.siteId || !r.visitorHash) continue;
    const key = `${r.siteId}|${r.visitorHash}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  let sessionsCreated = 0;
  let eventsLinked = 0;

  for (const [, group] of groups) {
    const siteId = group[0]!.siteId!;
    const visitorHash = group[0]!.visitorHash!;
    const sessions = sessionizeEvents(
      group.map((g) => ({
        ...g,
        occurredAt: g.occurredAt,
        path: g.path,
      })),
      idleMs,
    );

    for (const s of sessions) {
      const first = s.events[0]!;
      const session = await repos.analyticsRepo.createSession(db, {
        siteId,
        visitorHash,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        entryPath: s.entryPath,
        referrerHost: first.referrerHost,
        utm: utmFromProps((first.props as Record<string, unknown>) ?? undefined),
        deviceCategory: first.deviceCategory,
        browserFamily: first.browserFamily,
        geoCountry: first.geoCountry,
        geoRegion: first.geoRegion,
        geoCity: first.geoCity,
      });
      sessionsCreated += 1;
      const ids = s.events.map((e) => e.id);
      await repos.analyticsRepo.attachEventsToSession(db, session.id, ids);
      eventsLinked += ids.length;
    }
  }

  const idleBefore = new Date(now.getTime() - idleMs);
  const closed = await repos.analyticsRepo.closeIdleSessions(db, idleBefore);

  return { sessionsCreated, eventsLinked, sessionsClosed: closed, scanned: rows.length };
}

export async function runAnalyticsRetention(
  db: Database,
  opts: { retentionDays?: number; now?: Date } = {},
) {
  const days = opts.retentionDays ?? ANALYTICS_RETENTION_DAYS_DEFAULT;
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  return repos.analyticsRepo.purgeAnalyticsOlderThan(db, cutoff);
}

export { MAX_BODY_BYTES, hashSource };
