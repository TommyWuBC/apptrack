import { and, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import { connectedEmailAccounts } from "../schema/index.js";

export type CreateAccountInput = {
  userId: string;
  provider?: string;
  providerAccountEmail: string;
  status?: string;
};

export async function createConnectedAccount(
  db: Database,
  input: CreateAccountInput,
) {
  const id = uuidv7();
  const [row] = await db
    .insert(connectedEmailAccounts)
    .values({
      id,
      userId: input.userId,
      provider: input.provider ?? "gmail",
      providerAccountEmail: input.providerAccountEmail.toLowerCase(),
      status: input.status ?? "active",
    })
    .returning();
  return row!;
}

export async function getAccountById(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(connectedEmailAccounts)
    .where(eq(connectedEmailAccounts.id, id))
    .limit(1);
  return row ?? null;
}

export async function listAccountsForUser(db: Database, userId: string) {
  return db
    .select()
    .from(connectedEmailAccounts)
    .where(eq(connectedEmailAccounts.userId, userId));
}

export async function updateSyncCursor(
  db: Database,
  accountId: string,
  syncCursor: string,
) {
  const [row] = await db
    .update(connectedEmailAccounts)
    .set({ syncCursor, lastSyncAt: new Date() })
    .where(eq(connectedEmailAccounts.id, accountId))
    .returning();
  return row ?? null;
}

export async function setAccountStatus(
  db: Database,
  accountId: string,
  status: string,
) {
  const [row] = await db
    .update(connectedEmailAccounts)
    .set({ status })
    .where(
      and(eq(connectedEmailAccounts.id, accountId)),
    )
    .returning();
  return row ?? null;
}

export async function updateBackfillState(
  db: Database,
  accountId: string,
  backfillState: Record<string, unknown> | null,
) {
  const [row] = await db
    .update(connectedEmailAccounts)
    .set({ backfillState })
    .where(eq(connectedEmailAccounts.id, accountId))
    .returning();
  return row ?? null;
}

export async function listActiveAccounts(db: Database) {
  return db
    .select()
    .from(connectedEmailAccounts)
    .where(eq(connectedEmailAccounts.status, "active"));
}
