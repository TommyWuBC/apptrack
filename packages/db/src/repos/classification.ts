/**
 * classification_results + classifier_versions repos. AGENTS.md §10.3
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import {
  classificationResults,
  classifierVersions,
  extractedEntities,
  userCorrections,
} from "../schema/index.js";

export async function ensureClassifierVersion(
  db: Database,
  input: {
    versionString: string;
    rulesVersion: string;
    promptVersion?: string | null;
    modelId?: string | null;
    extractionSchemaVersion: string;
  },
) {
  const existing = await getClassifierVersionByString(db, input.versionString);
  if (existing) return existing;
  const id = uuidv7();
  const [row] = await db
    .insert(classifierVersions)
    .values({
      id,
      versionString: input.versionString,
      rulesVersion: input.rulesVersion,
      promptVersion: input.promptVersion ?? null,
      modelId: input.modelId ?? null,
      extractionSchemaVersion: input.extractionSchemaVersion,
    })
    .onConflictDoNothing({ target: classifierVersions.versionString })
    .returning();
  if (row) return row;
  return (await getClassifierVersionByString(db, input.versionString))!;
}

export async function getClassifierVersionByString(db: Database, versionString: string) {
  const [row] = await db
    .select()
    .from(classifierVersions)
    .where(eq(classifierVersions.versionString, versionString))
    .limit(1);
  return row ?? null;
}

export type InsertClassificationInput = {
  messageId: string;
  classifierVersionId: string;
  mode: string;
  eventType: string;
  isJobRelated: boolean;
  confidence: number;
  evidence: unknown;
  extraction: unknown;
  needsReview: boolean;
  layerTrace?: unknown;
};

export async function insertClassificationIdempotent(
  db: Database,
  input: InsertClassificationInput,
): Promise<{ row: typeof classificationResults.$inferSelect; inserted: boolean }> {
  const existing = await getClassification(
    db,
    input.messageId,
    input.classifierVersionId,
  );
  if (existing) return { row: existing, inserted: false };

  const id = uuidv7();
  const inserted = await db
    .insert(classificationResults)
    .values({
      id,
      messageId: input.messageId,
      classifierVersionId: input.classifierVersionId,
      mode: input.mode,
      eventType: input.eventType,
      isJobRelated: input.isJobRelated,
      confidence: input.confidence,
      evidence: input.evidence,
      extraction: input.extraction,
      needsReview: input.needsReview,
      layerTrace: input.layerTrace ?? null,
    })
    .onConflictDoNothing({
      target: [
        classificationResults.messageId,
        classificationResults.classifierVersionId,
      ],
    })
    .returning();

  if (inserted[0]) return { row: inserted[0], inserted: true };
  const again = await getClassification(db, input.messageId, input.classifierVersionId);
  return { row: again!, inserted: false };
}

export async function getClassification(
  db: Database,
  messageId: string,
  classifierVersionId: string,
) {
  const [row] = await db
    .select()
    .from(classificationResults)
    .where(
      and(
        eq(classificationResults.messageId, messageId),
        eq(classificationResults.classifierVersionId, classifierVersionId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Latest classification for a message (any version). */
export async function getLatestClassification(db: Database, messageId: string) {
  const rows = await db
    .select()
    .from(classificationResults)
    .where(eq(classificationResults.messageId, messageId));
  if (rows.length === 0) return null;
  // Prefer most recently created
  rows.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));
  return rows[0]!;
}

/**
 * Latest machine row with active field-level user corrections overlaid.
 * Corrections from older classifier versions remain authoritative (INV-7).
 */
export async function getEffectiveClassification(db: Database, messageId: string) {
  const rows = await db
    .select()
    .from(classificationResults)
    .where(eq(classificationResults.messageId, messageId));
  if (rows.length === 0) return null;
  rows.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));
  const latest = rows[0]!;
  const corrections = await db
    .select()
    .from(userCorrections)
    .where(
      and(
        eq(userCorrections.targetType, "classification"),
        inArray(
          userCorrections.targetId,
          rows.map((row) => row.id),
        ),
      ),
    )
    .orderBy(asc(userCorrections.createdAt));

  const effective = { ...latest };
  for (const correction of corrections) {
    if (correction.revertedAt) continue;
    switch (correction.field) {
      case "eventType":
        if (typeof correction.userValue === "string") {
          effective.eventType = correction.userValue;
        }
        break;
      case "isJobRelated":
        if (typeof correction.userValue === "boolean") {
          effective.isJobRelated = correction.userValue;
        }
        break;
      case "confidence":
        if (typeof correction.userValue === "number") {
          effective.confidence = correction.userValue;
        }
        break;
      case "needsReview":
        if (typeof correction.userValue === "boolean") {
          effective.needsReview = correction.userValue;
        }
        break;
    }
  }
  if (effective.eventType === "newsletter_ignore") {
    effective.isJobRelated = false;
    effective.needsReview = false;
  }
  return effective;
}

export async function insertExtractedEntities(
  db: Database,
  classificationResultId: string,
  extraction: Record<string, unknown>,
  fallbackConfidence: number,
) {
  const rows = Object.entries(extraction)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([entityType, value]) => {
      const valueText = value as string;
      return {
        id: uuidv7(),
        classificationResultId,
        entityType,
        valueText,
        valueNorm: valueText.toLowerCase().trim().replace(/\s+/g, " "),
        confidence:
          typeof extraction.confidence === "number"
            ? extraction.confidence
            : fallbackConfidence,
      };
    });
  if (rows.length === 0) return 0;
  await db.insert(extractedEntities).values(rows);
  return rows.length;
}
