import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import { emailMessages, emailThreads } from "../schema/index.js";

export type InsertMessageInput = {
  accountId: string;
  providerMessageId: string;
  providerThreadId?: string;
  internalDate: Date;
  fromAddress?: string;
  fromName?: string;
  toAddresses?: string[];
  subject?: string;
  snippet?: string;
  headersSubset?: Record<string, unknown>;
};

/**
 * Idempotent insert (INV-2): unique(account_id, provider_message_id).
 * Returns { row, inserted } — only enqueue normalize when inserted=true.
 */
export async function insertEmailMessageIdempotent(
  db: Database,
  input: InsertMessageInput,
): Promise<{ row: typeof emailMessages.$inferSelect; inserted: boolean }> {
  let threadId: string | null = null;
  if (input.providerThreadId) {
    const existing = await db
      .select()
      .from(emailThreads)
      .where(
        and(
          eq(emailThreads.accountId, input.accountId),
          eq(emailThreads.providerThreadId, input.providerThreadId),
        ),
      )
      .limit(1);
    if (existing[0]) {
      threadId = existing[0].id;
    } else {
      const id = uuidv7();
      const [t] = await db
        .insert(emailThreads)
        .values({
          id,
          accountId: input.accountId,
          providerThreadId: input.providerThreadId,
        })
        .onConflictDoNothing({
          target: [emailThreads.accountId, emailThreads.providerThreadId],
        })
        .returning();
      if (t) {
        threadId = t.id;
      } else {
        const [again] = await db
          .select()
          .from(emailThreads)
          .where(
            and(
              eq(emailThreads.accountId, input.accountId),
              eq(emailThreads.providerThreadId, input.providerThreadId),
            ),
          )
          .limit(1);
        threadId = again?.id ?? null;
      }
    }
  }

  const id = uuidv7();
  const inserted = await db
    .insert(emailMessages)
    .values({
      id,
      accountId: input.accountId,
      threadId,
      providerMessageId: input.providerMessageId,
      internalDate: input.internalDate,
      fromAddress: input.fromAddress,
      fromName: input.fromName,
      toAddresses: input.toAddresses,
      subject: input.subject,
      snippet: input.snippet,
      headersSubset: input.headersSubset,
    })
    .onConflictDoNothing({
      target: [emailMessages.accountId, emailMessages.providerMessageId],
    })
    .returning();

  if (inserted[0]) {
    return { row: inserted[0], inserted: true };
  }

  const [existingMsg] = await db
    .select()
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.accountId, input.accountId),
        eq(emailMessages.providerMessageId, input.providerMessageId),
      ),
    )
    .limit(1);
  return { row: existingMsg!, inserted: false };
}

export async function getEmailMessageById(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(emailMessages)
    .where(eq(emailMessages.id, id))
    .limit(1);
  return row ?? null;
}

export async function tombstoneProviderDeletion(
  db: Database,
  accountId: string,
  providerMessageId: string,
) {
  await db
    .update(emailMessages)
    .set({ deletedAtProvider: new Date() })
    .where(
      and(
        eq(emailMessages.accountId, accountId),
        eq(emailMessages.providerMessageId, providerMessageId),
      ),
    );
}

export async function countMessages(db: Database): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emailMessages);
  return row?.n ?? 0;
}
