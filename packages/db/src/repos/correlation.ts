/**
 * Correlation predictions + features repos. AGENTS.md §10.6 / §21 / M16
 */
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import {
  correlationFeatures,
  correlationPredictions,
} from "../schema/index.js";

export type InsertPredictionInput = {
  applicationId: string;
  sessionId: string;
  score: number;
  confidenceBand: string;
  deterministic: boolean;
  algorithmVersion: string;
  explanation: string;
  features: Array<{
    featureName: string;
    featureValue: unknown;
    weight: number;
    contribution: number;
  }>;
};

/** Idempotent on (application_id, session_id, algorithm_version). */
export async function insertPredictionIdempotent(
  db: Database,
  input: InsertPredictionInput,
): Promise<{ row: typeof correlationPredictions.$inferSelect; inserted: boolean }> {
  const existing = await getPrediction(
    db,
    input.applicationId,
    input.sessionId,
    input.algorithmVersion,
  );
  if (existing) return { row: existing, inserted: false };

  const id = uuidv7();
  const inserted = await db
    .insert(correlationPredictions)
    .values({
      id,
      applicationId: input.applicationId,
      sessionId: input.sessionId,
      score: input.score,
      confidenceBand: input.confidenceBand,
      deterministic: input.deterministic,
      algorithmVersion: input.algorithmVersion,
      explanation: input.explanation,
    })
    .onConflictDoNothing({
      target: [
        correlationPredictions.applicationId,
        correlationPredictions.sessionId,
        correlationPredictions.algorithmVersion,
      ],
    })
    .returning();

  const row = inserted[0] ?? (await getPrediction(
    db,
    input.applicationId,
    input.sessionId,
    input.algorithmVersion,
  ))!;
  if (inserted[0] && input.features.length > 0) {
    await db.insert(correlationFeatures).values(
      input.features.map((feature) => ({
        id: uuidv7(),
        predictionId: row.id,
        featureName: feature.featureName,
        featureValue: feature.featureValue ?? {},
        weight: feature.weight,
        contribution: feature.contribution,
      })),
    );
  }
  return { row, inserted: Boolean(inserted[0]) };
}

export async function getPrediction(
  db: Database,
  applicationId: string,
  sessionId: string,
  algorithmVersion: string,
) {
  const [row] = await db
    .select()
    .from(correlationPredictions)
    .where(
      and(
        eq(correlationPredictions.applicationId, applicationId),
        eq(correlationPredictions.sessionId, sessionId),
        eq(correlationPredictions.algorithmVersion, algorithmVersion),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listPredictionsForApplication(
  db: Database,
  applicationId: string,
  opts: { limit?: number } = {},
) {
  return db
    .select()
    .from(correlationPredictions)
    .where(eq(correlationPredictions.applicationId, applicationId))
    .orderBy(desc(correlationPredictions.createdAt))
    .limit(opts.limit ?? 50);
}

export async function getPredictionById(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(correlationPredictions)
    .where(eq(correlationPredictions.id, id))
    .limit(1);
  return row ?? null;
}

export async function listFeaturesForPrediction(db: Database, predictionId: string) {
  return db
    .select()
    .from(correlationFeatures)
    .where(eq(correlationFeatures.predictionId, predictionId));
}

export async function setPredictionFeedback(
  db: Database,
  predictionId: string,
  feedback: "confirmed" | "rejected",
) {
  const [row] = await db
    .update(correlationPredictions)
    .set({ userFeedback: feedback })
    .where(eq(correlationPredictions.id, predictionId))
    .returning();
  return row ?? null;
}
