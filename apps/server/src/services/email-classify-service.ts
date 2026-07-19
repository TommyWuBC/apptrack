/**
 * email.classify orchestration. AGENTS.md §13 / M7 / M13
 */
import {
  classifyEmail,
  CLASSIFIER_VERSION,
  RULES_VERSION,
  EXTRACTION_SCHEMA_VERSION,
  PROMPT_VERSION,
} from "@apptrack/core";
import {
  ClassifierMode,
  ClassifierSettingsV1Schema,
  ReviewKind,
  type ClassificationResultV1,
} from "@apptrack/shared";
import { repos, type Database } from "@apptrack/db";
import { resolveClassifierConfig } from "./classifier-config.js";

const { emailsRepo, normalizedEmailsRepo, classificationRepo, matchingRepo } = repos;

export type ClassifyStoredResult = {
  messageId: string;
  inserted: boolean;
  classificationId: string;
  result: ClassificationResultV1;
  classifierVersion: string;
  mode: string;
  promptVersion: string | null;
  modelId: string | null;
};

export async function classifyAndStoreMessage(
  db: Database,
  messageId: string,
  opts: { userId?: string } = {},
): Promise<ClassifyStoredResult> {
  const msg = await emailsRepo.getEmailMessageById(db, messageId);
  if (!msg) throw new Error("message_not_found");

  const norm = await normalizedEmailsRepo.getLatestNormalized(db, messageId);
  const headers = (msg.headersSubset as Record<string, string> | null) ?? undefined;

  let settings = null;
  const userId = opts.userId ?? (await repos.usersRepo.getFirstUser(db))?.id ?? null;
  if (userId) {
    const row = await repos.settingsRepo.getSettingsForUser(db, userId);
    settings = row?.classifierSettings
      ? ClassifierSettingsV1Schema.safeParse(row.classifierSettings).data
      : null;
  }

  const config = resolveClassifierConfig(settings);
  const result = await classifyEmail(
    {
      subject: msg.subject ?? undefined,
      textPlain: norm?.textPlain ?? undefined,
      textFull: norm?.textFull ?? msg.snippet ?? undefined,
      fromAddress: msg.fromAddress ?? undefined,
      fromName: msg.fromName ?? undefined,
      headers,
      links: (norm?.links as Array<{ url: string }> | null) ?? undefined,
      calendarEvent:
        (norm?.calendarEvent as { summary?: string; start?: string } | null) ?? null,
    },
    { mode: config.mode, llm: config.llm },
  );

  const version = await classificationRepo.ensureClassifierVersion(db, {
    versionString: CLASSIFIER_VERSION,
    rulesVersion: RULES_VERSION,
    promptVersion: config.mode === ClassifierMode.deterministic ? null : PROMPT_VERSION,
    modelId: config.modelId,
    extractionSchemaVersion: EXTRACTION_SCHEMA_VERSION,
  });

  const { row, inserted } = await classificationRepo.insertClassificationIdempotent(
    db,
    {
      messageId,
      classifierVersionId: version.id,
      mode: config.mode,
      eventType: result.eventType,
      isJobRelated: result.isJobRelated,
      confidence: result.confidence,
      evidence: result.evidence,
      extraction: result.extraction,
      needsReview: result.needsReview,
      layerTrace: result.layerTrace,
    },
  );

  if (inserted) {
    await classificationRepo.insertExtractedEntities(
      db,
      row.id,
      (result.extraction ?? {}) as Record<string, unknown>,
      result.confidence,
    );
    if (result.needsReview) {
      const open = await matchingRepo.listOpenReviewItems(db, {
        kind: ReviewKind.uncertain_classification,
        refId: messageId,
      });
      if (open.length === 0) {
        await matchingRepo.createReviewItem(db, {
          kind: ReviewKind.uncertain_classification,
          refId: messageId,
          resolution: {
            classificationResultId: row.id,
            eventType: result.eventType,
            confidence: result.confidence,
          },
        });
      }
    }
  }

  // Prefer the persisted row so same-version re-runs stay auditable and stable.
  const persisted: ClassificationResultV1 = {
    eventType: row.eventType as ClassificationResultV1["eventType"],
    isJobRelated: row.isJobRelated,
    confidence: row.confidence,
    evidence: result.evidence,
    extraction: result.extraction,
    needsReview: row.needsReview,
    layerTrace: result.layerTrace,
  };

  return {
    messageId,
    inserted,
    classificationId: row.id,
    result: persisted,
    classifierVersion: CLASSIFIER_VERSION,
    mode: config.mode,
    promptVersion: config.mode === ClassifierMode.deterministic ? null : PROMPT_VERSION,
    modelId: config.modelId,
  };
}
