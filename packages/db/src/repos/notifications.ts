/**
 * In-app notifications. AGENTS.md §10.5 / §17
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import { notifications } from "../schema/index.js";

export async function createNotification(
  db: Database,
  input: {
    userId: string;
    kind: string;
    title: string;
    body?: string;
    link?: string;
  },
) {
  const id = uuidv7();
  const [row] = await db
    .insert(notifications)
    .values({
      id,
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      link: input.link,
    })
    .returning();
  return row!;
}

export async function listNotificationsForUser(
  db: Database,
  userId: string,
  opts: { unreadOnly?: boolean; limit?: number } = {},
) {
  const conditions = [eq(notifications.userId, userId)];
  if (opts.unreadOnly) {
    conditions.push(isNull(notifications.readAt));
  }
  const q = db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(opts.limit ?? 50);
  return q;
}

export async function markNotificationRead(
  db: Database,
  notificationId: string,
) {
  const [row] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(eq(notifications.id, notificationId))
    .returning();
  return row ?? null;
}

/** Idempotency helper: recent notification for same kind+link. */
export async function findRecentNotification(
  db: Database,
  userId: string,
  kind: string,
  link: string,
) {
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.kind, kind),
        eq(notifications.link, link),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
