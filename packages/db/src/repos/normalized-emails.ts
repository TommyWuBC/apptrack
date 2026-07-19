/**
 * normalized_emails repo — versioned idempotent inserts. AGENTS.md §10.2 / §10.7
 */
import { and, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import { emailAttachments, normalizedEmails } from "../schema/index.js";

export type InsertNormalizedInput = {
  messageId: string;
  textPlain: string;
  textFull: string;
  sanitizedHtml?: string | null;
  detectedLanguage?: string | null;
  links?: unknown;
  calendarEvent?: unknown;
  normalizerVersion: string;
  attachments?: Array<{
    filename?: string;
    mimeType?: string;
    sizeBytes: number;
    sha256?: string;
  }>;
};

export async function insertNormalizedEmailIdempotent(
  db: Database,
  input: InsertNormalizedInput,
): Promise<{ row: typeof normalizedEmails.$inferSelect; inserted: boolean }> {
  const existing = await getNormalizedByMessageVersion(
    db,
    input.messageId,
    input.normalizerVersion,
  );
  if (existing) return { row: existing, inserted: false };

  const id = uuidv7();
  const inserted = await db
    .insert(normalizedEmails)
    .values({
      id,
      messageId: input.messageId,
      textPlain: input.textPlain,
      textFull: input.textFull,
      sanitizedHtml: input.sanitizedHtml ?? null,
      detectedLanguage: input.detectedLanguage ?? null,
      links: input.links ?? [],
      calendarEvent: input.calendarEvent ?? null,
      normalizerVersion: input.normalizerVersion,
    })
    .onConflictDoNothing({
      target: [normalizedEmails.messageId, normalizedEmails.normalizerVersion],
    })
    .returning();

  if (inserted[0]) {
    for (const a of input.attachments ?? []) {
      await db.insert(emailAttachments).values({
        id: uuidv7(),
        messageId: input.messageId,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        sha256: a.sha256,
      });
    }
    return { row: inserted[0], inserted: true };
  }

  const again = await getNormalizedByMessageVersion(
    db,
    input.messageId,
    input.normalizerVersion,
  );
  return { row: again!, inserted: false };
}

export async function getNormalizedByMessageVersion(
  db: Database,
  messageId: string,
  normalizerVersion: string,
) {
  const [row] = await db
    .select()
    .from(normalizedEmails)
    .where(
      and(
        eq(normalizedEmails.messageId, messageId),
        eq(normalizedEmails.normalizerVersion, normalizerVersion),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getLatestNormalized(db: Database, messageId: string) {
  const rows = await db
    .select()
    .from(normalizedEmails)
    .where(eq(normalizedEmails.messageId, messageId));
  // versions are append-only strings; pick latest created_at
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows[0] ?? null;
}
