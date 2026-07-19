/**
 * Match candidates + review queue repos. AGENTS.md §10.4–10.5 / M8
 */
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import {
  applicationEvents,
  applicationMatchCandidates,
  applications,
  companies,
  companyAliases,
  reviewQueueItems,
  roles,
} from "../schema/index.js";

export async function findCompanyByCanonicalName(db: Database, canonicalName: string) {
  const [row] = await db
    .select()
    .from(companies)
    .where(eq(companies.canonicalName, canonicalName))
    .limit(1);
  return row ?? null;
}

export async function listCompanyAliases(db: Database) {
  return db
    .select({
      companyId: companyAliases.companyId,
      canonicalName: companies.canonicalName,
      alias: companyAliases.alias,
      aliasType: companyAliases.aliasType,
    })
    .from(companyAliases)
    .innerJoin(companies, eq(companies.id, companyAliases.companyId));
}

export async function addCompanyAlias(
  db: Database,
  input: {
    companyId: string;
    alias: string;
    aliasType: string;
    source?: string;
  },
) {
  const id = uuidv7();
  const [row] = await db
    .insert(companyAliases)
    .values({
      id,
      companyId: input.companyId,
      alias: input.alias,
      aliasType: input.aliasType,
      source: input.source ?? "auto",
    })
    .onConflictDoNothing({
      target: [companyAliases.alias, companyAliases.aliasType],
    })
    .returning();
  return row ?? null;
}

export async function createRole(
  db: Database,
  input: {
    companyId: string;
    titleRaw: string;
    titleNorm?: string;
    level?: string;
    requisitionId?: string;
    postingUrl?: string;
    location?: unknown;
    workArrangement?: string;
  },
) {
  const id = uuidv7();
  const [row] = await db
    .insert(roles)
    .values({
      id,
      companyId: input.companyId,
      titleRaw: input.titleRaw,
      titleNorm: input.titleNorm,
      level: input.level,
      requisitionId: input.requisitionId,
      postingUrl: input.postingUrl,
      location: input.location,
      workArrangement: input.workArrangement,
    })
    .returning();
  return row!;
}

export async function getRoleById(db: Database, id: string) {
  const [row] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  return row ?? null;
}

export type ApplicationMatchRow = {
  applicationId: string;
  userId: string;
  companyId: string;
  currentState: string;
  lastEventAt: Date | null;
  appliedAt: Date | null;
  roleId: string | null;
  roleTitle: string | null;
  requisitionId: string | null;
  postingUrl: string | null;
  location: unknown;
};

export async function listApplicationsAtCompany(
  db: Database,
  userId: string,
  companyId: string,
): Promise<ApplicationMatchRow[]> {
  const rows = await db
    .select({
      applicationId: applications.id,
      userId: applications.userId,
      companyId: applications.companyId,
      currentState: applications.currentState,
      lastEventAt: applications.lastEventAt,
      appliedAt: applications.appliedAt,
      roleId: applications.roleId,
      roleTitle: roles.titleRaw,
      requisitionId: roles.requisitionId,
      postingUrl: roles.postingUrl,
      location: roles.location,
    })
    .from(applications)
    .leftJoin(roles, eq(roles.id, applications.roleId))
    .where(and(eq(applications.userId, userId), eq(applications.companyId, companyId)));
  return rows;
}

/** Applications that already have an event from a message in the same thread. */
export async function listApplicationIdsForThread(
  db: Database,
  threadMessageIds: string[],
): Promise<Set<string>> {
  if (threadMessageIds.length === 0) return new Set();
  const rows = await db
    .select({ applicationId: applicationEvents.applicationId })
    .from(applicationEvents)
    .where(inArray(applicationEvents.messageId, threadMessageIds));
  return new Set(rows.map((r) => r.applicationId));
}

export async function listRecruiterEmailsForApplication(
  db: Database,
  applicationId: string,
): Promise<string[]> {
  const rows = await db
    .select({ payload: applicationEvents.payload })
    .from(applicationEvents)
    .where(eq(applicationEvents.applicationId, applicationId));
  const emails = new Set<string>();
  for (const r of rows) {
    const p = r.payload as Record<string, unknown> | null;
    const e = p?.recruiterEmail;
    if (typeof e === "string" && e.includes("@")) emails.add(e.toLowerCase());
    const from = p?.fromAddress;
    if (typeof from === "string" && from.includes("@")) emails.add(from.toLowerCase());
  }
  return [...emails];
}

export async function listAssessmentProvidersForApplication(
  db: Database,
  applicationId: string,
): Promise<string[]> {
  const rows = await db
    .select({ payload: applicationEvents.payload })
    .from(applicationEvents)
    .where(eq(applicationEvents.applicationId, applicationId));
  const providers = new Set<string>();
  for (const r of rows) {
    const p = r.payload as Record<string, unknown> | null;
    const a = p?.assessmentProvider;
    if (typeof a === "string" && a.length > 0) providers.add(a);
  }
  return [...providers];
}

export async function insertMatchCandidate(
  db: Database,
  input: {
    messageId: string;
    applicationId?: string | null;
    score: number;
    signals: unknown;
    decision: string;
    matcherVersion: string;
  },
) {
  const id = uuidv7();
  const [row] = await db
    .insert(applicationMatchCandidates)
    .values({
      id,
      messageId: input.messageId,
      applicationId: input.applicationId ?? null,
      score: input.score,
      signals: input.signals,
      decision: input.decision,
      matcherVersion: input.matcherVersion,
    })
    .returning();
  return row!;
}

export async function listMatchCandidatesForMessage(db: Database, messageId: string) {
  return db
    .select()
    .from(applicationMatchCandidates)
    .where(eq(applicationMatchCandidates.messageId, messageId));
}

export async function createReviewItem(
  db: Database,
  input: {
    kind: string;
    refId: string;
    resolution?: unknown;
  },
) {
  const id = uuidv7();
  const [row] = await db
    .insert(reviewQueueItems)
    .values({
      id,
      kind: input.kind,
      refId: input.refId,
      status: "open",
      resolution: input.resolution ?? null,
    })
    .returning();
  return row!;
}

export async function listOpenReviewItems(
  db: Database,
  opts: { kind?: string; refId?: string } = {},
) {
  const rows = await db
    .select()
    .from(reviewQueueItems)
    .where(eq(reviewQueueItems.status, "open"));
  return rows.filter((r) => {
    if (opts.kind && r.kind !== opts.kind) return false;
    if (opts.refId && r.refId !== opts.refId) return false;
    return true;
  });
}

export async function resolveReviewItem(db: Database, id: string, resolution: unknown) {
  const [row] = await db
    .update(reviewQueueItems)
    .set({ status: "resolved", resolution })
    .where(eq(reviewQueueItems.id, id))
    .returning();
  return row ?? null;
}

export async function findOpenAmbiguousForCompany(db: Database, companyId: string) {
  const open = await listOpenReviewItems(db, { kind: "ambiguous_match" });
  return open.filter((item) => {
    const res = item.resolution as { companyId?: string } | null;
    return res?.companyId === companyId;
  });
}

export async function getReviewItemById(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(reviewQueueItems)
    .where(eq(reviewQueueItems.id, id))
    .limit(1);
  return row ?? null;
}

export async function dismissReviewItem(db: Database, id: string, resolution: unknown) {
  const [row] = await db
    .update(reviewQueueItems)
    .set({ status: "dismissed", resolution })
    .where(eq(reviewQueueItems.id, id))
    .returning();
  return row ?? null;
}
