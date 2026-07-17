/**
 * email.classify orchestration. AGENTS.md §13 / M7
 */
import {
  classifyEmail,
  CLASSIFIER_VERSION,
  RULES_VERSION,
  EXTRACTION_SCHEMA_VERSION,
} from "@apptrack/core";
import {
  ClassifierMode,
  type ClassificationResultV1,
} from "@apptrack/shared";
import { repos, type Database } from "@apptrack/db";

const { emailsRepo, normalizedEmailsRepo, classificationRepo } = repos;

export type ClassifyStoredResult = {
  messageId: string;
  inserted: boolean;
  result: ClassificationResultV1;
  classifierVersion: string;
};

export async function classifyAndStoreMessage(
  db: Database,
  messageId: string,
): Promise<ClassifyStoredResult> {
  const msg = await emailsRepo.getEmailMessageById(db, messageId);
  if (!msg) throw new Error("message_not_found");

  const norm = await normalizedEmailsRepo.getLatestNormalized(db, messageId);
  const headers =
    (msg.headersSubset as Record<string, string> | null) ?? undefined;

  const result = classifyEmail({
    subject: msg.subject ?? undefined,
    textPlain: norm?.textPlain ?? undefined,
    textFull: norm?.textFull ?? msg.snippet ?? undefined,
    fromAddress: msg.fromAddress ?? undefined,
    fromName: msg.fromName ?? undefined,
    headers,
    links: (norm?.links as Array<{ url: string }> | null) ?? undefined,
    calendarEvent:
      (norm?.calendarEvent as { summary?: string; start?: string } | null) ??
      null,
  });

  const version = await classificationRepo.ensureClassifierVersion(db, {
    versionString: CLASSIFIER_VERSION,
    rulesVersion: RULES_VERSION,
    promptVersion: null,
    modelId: null,
    extractionSchemaVersion: EXTRACTION_SCHEMA_VERSION,
  });

  const { inserted } = await classificationRepo.insertClassificationIdempotent(
    db,
    {
      messageId,
      classifierVersionId: version.id,
      mode: ClassifierMode.deterministic,
      eventType: result.eventType,
      isJobRelated: result.isJobRelated,
      confidence: result.confidence,
      evidence: result.evidence,
      extraction: result.extraction,
      needsReview: result.needsReview,
      layerTrace: result.layerTrace,
    },
  );

  return {
    messageId,
    inserted,
    result,
    classifierVersion: CLASSIFIER_VERSION,
  };
}
