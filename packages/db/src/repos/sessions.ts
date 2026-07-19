import { eq, lt, or } from "drizzle-orm";
import type { Database } from "../client.js";
import { sessions } from "../schema/index.js";

export type CreateSessionInput = {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  idleExpiresAt: Date;
  ipCountry?: string | null;
};

export async function createSession(db: Database, input: CreateSessionInput) {
  const [row] = await db
    .insert(sessions)
    .values({
      id: input.tokenHash,
      userId: input.userId,
      expiresAt: input.expiresAt,
      idleExpiresAt: input.idleExpiresAt,
      ipCountry: input.ipCountry ?? null,
    })
    .returning();
  return row!;
}

export async function getActiveSession(
  db: Database,
  tokenHash: string,
  now = new Date(),
) {
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, tokenHash))
    .limit(1);
  if (!row || row.expiresAt <= now || row.idleExpiresAt <= now) return null;
  return row;
}

export async function touchSession(db: Database, tokenHash: string, idleExpiresAt: Date) {
  const [row] = await db
    .update(sessions)
    .set({ idleExpiresAt })
    .where(eq(sessions.id, tokenHash))
    .returning();
  return row ?? null;
}

export async function deleteSession(db: Database, tokenHash: string) {
  const rows = await db
    .delete(sessions)
    .where(eq(sessions.id, tokenHash))
    .returning({ id: sessions.id });
  return rows.length;
}

export async function deleteSessionsForUser(db: Database, userId: string) {
  const rows = await db
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ id: sessions.id });
  return rows.length;
}

export async function deleteExpiredSessions(db: Database, now = new Date()) {
  const rows = await db
    .delete(sessions)
    .where(or(lt(sessions.expiresAt, now), lt(sessions.idleExpiresAt, now)))
    .returning({ id: sessions.id });
  return rows.length;
}
