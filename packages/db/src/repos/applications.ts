import { asc, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import {
  applicationEvents,
  applications,
  companies,
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

export async function listEventsForApplication(
  db: Database,
  applicationId: string,
) {
  return db
    .select()
    .from(applicationEvents)
    .where(eq(applicationEvents.applicationId, applicationId))
    .orderBy(asc(applicationEvents.occurredAt), asc(applicationEvents.ingestedAt));
}

/** Find any event already attached to this message (idempotency for match). */
export async function findEventByMessageId(db: Database, messageId: string) {
  const [row] = await db
    .select()
    .from(applicationEvents)
    .where(eq(applicationEvents.messageId, messageId))
    .limit(1);
  return row ?? null;
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
