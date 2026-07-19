import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import {
  applicationEvents,
  applications,
  companies,
  companyAliases,
} from "../schema/index.js";

export async function createCompany(
  db: Database,
  canonicalName: string,
  opts: { primaryDomain?: string; isStaffingAgency?: boolean } = {},
) {
  const id = uuidv7();
  const [row] = await db
    .insert(companies)
    .values({
      id,
      canonicalName,
      primaryDomain: opts.primaryDomain,
      isStaffingAgency: opts.isStaffingAgency ?? false,
    })
    .returning();
  return row!;
}

export async function createApplication(
  db: Database,
  input: {
    userId: string;
    companyId: string;
    roleId?: string;
    currentState?: string;
    appliedAt?: Date;
    source?: string;
  },
) {
  const id = uuidv7();
  const [row] = await db
    .insert(applications)
    .values({
      id,
      userId: input.userId,
      companyId: input.companyId,
      roleId: input.roleId,
      currentState: input.currentState ?? "applied",
      appliedAt: input.appliedAt ?? new Date(),
      source: input.source,
      lastEventAt: input.appliedAt ?? new Date(),
    })
    .returning();
  return row!;
}

export async function getApplicationById(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1);
  return row ?? null;
}

export async function getApplicationByUniqueLinkToken(db: Database, token: string) {
  const [row] = await db
    .select()
    .from(applications)
    .where(eq(applications.uniqueLinkToken, token))
    .limit(1);
  return row ?? null;
}

export async function setApplicationUniqueLinkToken(
  db: Database,
  applicationId: string,
  token: string | null,
) {
  const [row] = await db
    .update(applications)
    .set({ uniqueLinkToken: token })
    .where(eq(applications.id, applicationId))
    .returning();
  return row ?? null;
}

export async function listApplicationsForUser(db: Database, userId: string) {
  return db.select().from(applications).where(eq(applications.userId, userId));
}

/**
 * Append-only event insert (INV-9). Never updates existing events.
 */
export async function appendApplicationEvent(
  db: Database,
  input: {
    applicationId: string;
    eventType: string;
    occurredAt: Date;
    source: "email" | "user" | "system";
    messageId?: string;
    classificationResultId?: string;
    payload?: Record<string, unknown>;
  },
) {
  const id = uuidv7();
  const [row] = await db
    .insert(applicationEvents)
    .values({
      id,
      applicationId: input.applicationId,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      source: input.source,
      messageId: input.messageId,
      classificationResultId: input.classificationResultId,
      payload: input.payload ?? {},
    })
    .returning();

  await db
    .update(applications)
    .set({ lastEventAt: input.occurredAt })
    .where(eq(applications.id, input.applicationId));

  return row!;
}

export async function listEventsForApplication(db: Database, applicationId: string) {
  return db
    .select()
    .from(applicationEvents)
    .where(eq(applicationEvents.applicationId, applicationId))
    .orderBy(asc(applicationEvents.occurredAt), asc(applicationEvents.ingestedAt));
}

/** Find an active (non-superseded) event for this message. AGENTS.md §16 / INV-9 */
export async function findEventByMessageId(db: Database, messageId: string) {
  const [row] = await db
    .select()
    .from(applicationEvents)
    .where(
      and(
        eq(applicationEvents.messageId, messageId),
        isNull(applicationEvents.supersededBy),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listActiveEventsByMessageId(db: Database, messageId: string) {
  return db
    .select()
    .from(applicationEvents)
    .where(
      and(
        eq(applicationEvents.messageId, messageId),
        isNull(applicationEvents.supersededBy),
      ),
    );
}

export async function updateApplicationProjection(
  db: Database,
  applicationId: string,
  patch: {
    currentState?: string;
    ghostStatus?: string;
    actionRequired?: boolean;
    stateVersion?: string;
  },
) {
  const [row] = await db
    .update(applications)
    .set(patch)
    .where(eq(applications.id, applicationId))
    .returning();
  return row ?? null;
}

/** Set last_event_at from reducer (handles out-of-order appends). */
export async function touchLastEventAt(
  db: Database,
  applicationId: string,
  lastEventAt: Date,
) {
  const [row] = await db
    .update(applications)
    .set({ lastEventAt })
    .where(eq(applications.id, applicationId))
    .returning();
  return row ?? null;
}

export async function getCompanyById(db: Database, id: string) {
  const [row] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return row ?? null;
}

export async function listCompanies(db: Database) {
  return db.select().from(companies);
}

export async function listApplicationsWithCompany(db: Database, userId: string) {
  return db
    .select({
      id: applications.id,
      userId: applications.userId,
      companyId: applications.companyId,
      companyName: companies.canonicalName,
      roleId: applications.roleId,
      currentState: applications.currentState,
      appliedAt: applications.appliedAt,
      source: applications.source,
      lastEventAt: applications.lastEventAt,
      ghostStatus: applications.ghostStatus,
      actionRequired: applications.actionRequired,
      stateVersion: applications.stateVersion,
      uniqueLinkToken: applications.uniqueLinkToken,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
    })
    .from(applications)
    .innerJoin(companies, eq(companies.id, applications.companyId))
    .where(eq(applications.userId, userId));
}

export async function getEventById(db: Database, eventId: string) {
  const [row] = await db
    .select()
    .from(applicationEvents)
    .where(eq(applicationEvents.id, eventId))
    .limit(1);
  return row ?? null;
}

/**
 * Mark an event superseded (reattach path). Allowed mutation of superseded_by only.
 * // AGENTS.md §10.4 / §18
 */
export async function markEventSuperseded(
  db: Database,
  eventId: string,
  supersededBy: string,
) {
  const [row] = await db
    .update(applicationEvents)
    .set({ supersededBy })
    .where(eq(applicationEvents.id, eventId))
    .returning();
  return row ?? null;
}

export async function updateApplicationCompany(
  db: Database,
  applicationId: string,
  companyId: string,
) {
  const [row] = await db
    .update(applications)
    .set({ companyId })
    .where(eq(applications.id, applicationId))
    .returning();
  return row ?? null;
}

export async function updateApplicationUserFields(
  db: Database,
  applicationId: string,
  patch: {
    companyId?: string;
    roleId?: string | null;
    source?: string | null;
    appliedAt?: Date | null;
  },
) {
  const [row] = await db
    .update(applications)
    .set(patch)
    .where(eq(applications.id, applicationId))
    .returning();
  return row ?? null;
}

export async function updateCompanyCanonicalName(
  db: Database,
  companyId: string,
  canonicalName: string,
) {
  const [row] = await db
    .update(companies)
    .set({ canonicalName })
    .where(eq(companies.id, companyId))
    .returning();
  return row ?? null;
}

export async function reassignCompanyAliases(
  db: Database,
  fromCompanyId: string,
  toCompanyId: string,
) {
  await db
    .update(companyAliases)
    .set({ companyId: toCompanyId })
    .where(eq(companyAliases.companyId, fromCompanyId));
}

export async function reassignApplicationsCompany(
  db: Database,
  fromCompanyId: string,
  toCompanyId: string,
) {
  await db
    .update(applications)
    .set({ companyId: toCompanyId })
    .where(eq(applications.companyId, fromCompanyId));
}
