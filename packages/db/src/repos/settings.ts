/**
 * User settings (ghost thresholds). AGENTS.md §17 / M12
 */
import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import { userSettings } from "../schema/index.js";

export async function getSettingsForUser(db: Database, userId: string) {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertGhostThresholds(
  db: Database,
  userId: string,
  ghostThresholds: Record<string, unknown>,
) {
  const existing = await getSettingsForUser(db, userId);
  if (existing) {
    const [row] = await db
      .update(userSettings)
      .set({ ghostThresholds, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return row!;
  }
  const id = uuidv7();
  const [row] = await db
    .insert(userSettings)
    .values({
      id,
      userId,
      ghostThresholds,
    })
    .returning();
  return row!;
}

export async function upsertClassifierSettings(
  db: Database,
  userId: string,
  classifierSettings: Record<string, unknown>,
) {
  const existing = await getSettingsForUser(db, userId);
  if (existing) {
    const [row] = await db
      .update(userSettings)
      .set({ classifierSettings, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return row!;
  }
  const id = uuidv7();
  const [row] = await db
    .insert(userSettings)
    .values({
      id,
      userId,
      classifierSettings,
    })
    .returning();
  return row!;
}
