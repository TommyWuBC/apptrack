/**
 * Analytics sites / events / sessions repos. AGENTS.md §10.6 / §20 / M14
 * INV-8: never persist IP addresses.
 */
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import {
  analyticsEvents,
  analyticsSessions,
  analyticsSites,
} from "../schema/index.js";

function mintSiteKey(): string {
  return `pk_${randomBytes(18).toString("base64url")}`;
}

export async function createSite(
  db: Database,
  input: {
    userId: string;
    originAllowlist?: string[];
    mode?: string;
    siteKey?: string;
  },
) {
  const id = uuidv7();
  const [row] = await db
    .insert(analyticsSites)
    .values({
      id,
      userId: input.userId,
      siteKey: input.siteKey ?? mintSiteKey(),
      originAllowlist: input.originAllowlist ?? [],
      mode: input.mode ?? "full",
    })
    .returning();
  return row!;
}

export async function listSitesForUser(db: Database, userId: string) {
  return db
    .select()
    .from(analyticsSites)
    .where(eq(analyticsSites.userId, userId));
}

export async function getSiteById(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(analyticsSites)
    .where(eq(analyticsSites.id, id))
    .limit(1);
  return row ?? null;
}

export async function getSiteByKey(db: Database, siteKey: string) {
  const [row] = await db
    .select()
    .from(analyticsSites)
    .where(eq(analyticsSites.siteKey, siteKey))
    .limit(1);
  return row ?? null;
}

export async function updateSite(
  db: Database,
  id: string,
  patch: { originAllowlist?: string[]; mode?: string },
) {
  const [row] = await db
    .update(analyticsSites)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(analyticsSites.id, id))
    .returning();
  return row ?? null;
}

export async function deleteSite(db: Database, id: string) {
  const [row] = await db
    .delete(analyticsSites)
    .where(eq(analyticsSites.id, id))
    .returning();
  return row ?? null;
}

export type InsertEventInput = {
  eventId: string;
  siteId: string;
  visitorHash: string;
  eventType: string;
  path?: string | null;
  occurredAt: Date;
  props?: Record<string, unknown>;
  srcToken?: string | null;
  referrerHost?: string | null;
  deviceCategory?: string | null;
  browserFamily?: string | null;
  geoCountry?: string | null;
  geoRegion?: string | null;
  geoCity?: string | null;
};

/** Idempotent insert by event_id (INV-2). Returns whether a row was inserted. */
export async function insertEventIdempotent(
  db: Database,
  input: InsertEventInput,
): Promise<{ inserted: boolean; id: string }> {
  const id = uuidv7();
  const rows = await db
    .insert(analyticsEvents)
    .values({
      id,
      eventId: input.eventId,
      siteId: input.siteId,
      visitorHash: input.visitorHash,
      eventType: input.eventType,
      path: input.path ?? null,
      occurredAt: input.occurredAt,
      props: input.props ?? {},
      srcToken: input.srcToken ?? null,
      referrerHost: input.referrerHost ?? null,
      deviceCategory: input.deviceCategory ?? null,
      browserFamily: input.browserFamily ?? null,
      geoCountry: input.geoCountry ?? null,
      geoRegion: input.geoRegion ?? null,
      geoCity: input.geoCity ?? null,
      sessionId: null,
    })
    .onConflictDoNothing({ target: analyticsEvents.eventId })
    .returning({ id: analyticsEvents.id });
  if (rows[0]) return { inserted: true, id: rows[0].id };
  const [existing] = await db
    .select({ id: analyticsEvents.id })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.eventId, input.eventId))
    .limit(1);
  return { inserted: false, id: existing?.id ?? id };
}

export async function listUnsessionizedEvents(
  db: Database,
  opts: { limit?: number } = {},
) {
  return db
    .select()
    .from(analyticsEvents)
    .where(
      and(
        isNull(analyticsEvents.sessionId),
        isNull(analyticsEvents.sessionizedAt),
      ),
    )
    .limit(opts.limit ?? 2000);
}

export async function createSession(
  db: Database,
  input: {
    siteId: string;
    visitorHash: string;
    startedAt: Date;
    endedAt?: Date | null;
    entryPath?: string | null;
    referrerHost?: string | null;
    utm?: unknown;
    deviceCategory?: string | null;
    browserFamily?: string | null;
    geoCountry?: string | null;
    geoRegion?: string | null;
    geoCity?: string | null;
  },
) {
  const id = uuidv7();
  const [row] = await db
    .insert(analyticsSessions)
    .values({
      id,
      siteId: input.siteId,
      visitorHash: input.visitorHash,
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      entryPath: input.entryPath ?? null,
      referrerHost: input.referrerHost ?? null,
      utm: input.utm ?? null,
      deviceCategory: input.deviceCategory ?? null,
      browserFamily: input.browserFamily ?? null,
      geoCountry: input.geoCountry ?? null,
      geoRegion: input.geoRegion ?? null,
      geoCity: input.geoCity ?? null,
    })
    .returning();
  return row!;
}

export async function attachEventsToSession(
  db: Database,
  sessionId: string,
  eventRowIds: string[],
) {
  if (eventRowIds.length === 0) return;
  const now = new Date();
  for (const eid of eventRowIds) {
    await db
      .update(analyticsEvents)
      .set({ sessionId, sessionizedAt: now })
      .where(eq(analyticsEvents.id, eid));
  }
}

export async function closeIdleSessions(
  db: Database,
  idleBefore: Date,
) {
  const open = await db
    .select()
    .from(analyticsSessions)
    .where(isNull(analyticsSessions.endedAt));
  let n = 0;
  for (const s of open) {
    if (s.startedAt.getTime() < idleBefore.getTime()) {
      await db
        .update(analyticsSessions)
        .set({ endedAt: idleBefore })
        .where(eq(analyticsSessions.id, s.id));
      n += 1;
    }
  }
  return n;
}

export async function listSessionsForSite(
  db: Database,
  siteId: string,
  opts: { limit?: number } = {},
) {
  return db
    .select()
    .from(analyticsSessions)
    .where(eq(analyticsSessions.siteId, siteId))
    .limit(opts.limit ?? 100);
}

export async function summarizeSite(db: Database, siteId: string) {
  const [events] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.siteId, siteId));
  const [sessions] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(analyticsSessions)
    .where(eq(analyticsSessions.siteId, siteId));
  return {
    eventCount: events?.count ?? 0,
    sessionCount: sessions?.count ?? 0,
  };
}

/** Retention: delete old events/sessions (default ~13 months). D-5 */
export async function purgeAnalyticsOlderThan(db: Database, cutoff: Date) {
  const deletedEvents = await db
    .delete(analyticsEvents)
    .where(lt(analyticsEvents.occurredAt, cutoff))
    .returning({ id: analyticsEvents.id });
  const deletedSessions = await db
    .delete(analyticsSessions)
    .where(lt(analyticsSessions.startedAt, cutoff))
    .returning({ id: analyticsSessions.id });
  return {
    events: deletedEvents.length,
    sessions: deletedSessions.length,
  };
}

/** Test helper: hash an IP the same way rate-limit keys do (never stored). */
export function hashIpForRateLimit(ip: string): string {
  return createHash("sha256").update(`rl|${ip}`).digest("hex").slice(0, 16);
}
