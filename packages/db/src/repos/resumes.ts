/**
 * Per-user résumé blob for tracked download links. AGENTS.md §20.5 / M16
 */
import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import { userResumes } from "../schema/index.js";

export async function getResumeForUser(db: Database, userId: string) {
  const [row] = await db
    .select()
    .from(userResumes)
    .where(eq(userResumes.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertResume(
  db: Database,
  input: {
    userId: string;
    filename: string;
    contentType: string;
    bytes: Buffer;
  },
) {
  const existing = await getResumeForUser(db, input.userId);
  if (existing) {
    const [row] = await db
      .update(userResumes)
      .set({
        filename: input.filename,
        contentType: input.contentType,
        bytes: input.bytes,
        updatedAt: new Date(),
      })
      .where(eq(userResumes.userId, input.userId))
      .returning();
    return row!;
  }
  const [row] = await db
    .insert(userResumes)
    .values({
      id: uuidv7(),
      userId: input.userId,
      filename: input.filename,
      contentType: input.contentType,
      bytes: input.bytes,
    })
    .returning();
  return row!;
}

export async function deleteResumeForUser(db: Database, userId: string) {
  const rows = await db
    .delete(userResumes)
    .where(eq(userResumes.userId, userId))
    .returning({ id: userResumes.id });
  return rows.length;
}
