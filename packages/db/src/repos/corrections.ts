/**
 * user_corrections + audit_log repos. AGENTS.md §10.5 / §18 / M11
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import { auditLog, userCorrections } from "../schema/index.js";

export async function insertCorrection(
  db: Database,
  input: {
    targetType: string;
    targetId: string;
    field: string;
    machineValue?: unknown;
    userValue: unknown;
    locked?: boolean;
  },
) {
  const id = uuidv7();
  const [row] = await db
    .insert(userCorrections)
    .values({
      id,
      targetType: input.targetType,
      targetId: input.targetId,
      field: input.field,
      machineValue: input.machineValue ?? null,
      userValue: input.userValue,
      locked: input.locked ?? false,
    })
    .returning();
  return row!;
}

export async function listCorrectionsForTarget(
  db: Database,
  targetType: string,
  targetId: string,
) {
  return db
    .select()
    .from(userCorrections)
    .where(
      and(
        eq(userCorrections.targetType, targetType),
        eq(userCorrections.targetId, targetId),
      ),
    )
    .orderBy(asc(userCorrections.createdAt));
}

export async function listActiveCorrectionsForTarget(
  db: Database,
  targetType: string,
  targetId: string,
) {
  return db
    .select()
    .from(userCorrections)
    .where(
      and(
        eq(userCorrections.targetType, targetType),
        eq(userCorrections.targetId, targetId),
        isNull(userCorrections.revertedAt),
      ),
    )
    .orderBy(asc(userCorrections.createdAt));
}

export async function getCorrectionById(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(userCorrections)
    .where(eq(userCorrections.id, id))
    .limit(1);
  return row ?? null;
}

/** Undo = set reverted_at (append-only semantics). */
export async function revertCorrection(db: Database, id: string) {
  const [row] = await db
    .update(userCorrections)
    .set({ revertedAt: new Date() })
    .where(eq(userCorrections.id, id))
    .returning();
  return row ?? null;
}

export async function writeAuditLog(
  db: Database,
  input: {
    userId?: string | null;
    actor: string;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const id = uuidv7();
  const [row] = await db
    .insert(auditLog)
    .values({
      id,
      userId: input.userId ?? null,
      actor: input.actor,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? {},
    })
    .returning();
  return row!;
}
