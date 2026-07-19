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
  type ClassificationResultV1,
} from "@apptrack/shared";
import { repos, type Database } from "@apptrack/db";
import { resolveClassifierConfig } from "./classifier-config.js";

const { emailsRepo, normalizedEmailsRepo, classificationRepo } = repos;

export type ClassifyStoredResult = {
  messageId: string;
  inserted: boolean;
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
  const headers =
    (msg.headersSubset as Record<string, string> | null) ?? undefined;

  let settings = null;
  const userId =
    opts.userId ?? (await repos.usersRepo.getFirstUser(db))?.id ?? null;
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
        (norm?.calendarEvent as { summary?: string; start?: string } | null) ??
        null,
    },
    { mode: config.mode, llm: config.llm },
  );

  const version = await classificationRepo.ensureClassifierVersion(db, {
    versionString: CLASSIFIER_VERSION,
    rulesVersion: RULES_VERSION,
    promptVersion:
      config.mode === ClassifierMode.deterministic ? null : PROMPT_VERSION,
    modelId: config.modelId,
    extractionSchemaVersion: EXTRACTION_SCHEMA_VERSION,
  });

  const { inserted } = await classificationRepo.insertClassificationIdempotent(
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

  return {
    messageId,
    inserted,
    result,
    classifierVersion: CLASSIFIER_VERSION,
    mode: config.mode,
    promptVersion:
      config.mode === ClassifierMode.deterministic ? null : PROMPT_VERSION,
    modelId: config.modelId,
  };
}
