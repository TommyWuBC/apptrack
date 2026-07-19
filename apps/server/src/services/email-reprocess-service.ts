import { CLASSIFIER_VERSION } from "@apptrack/core";
import {
  EmailReprocessJobV1Schema,
  type EmailReprocessJobV1,
} from "@apptrack/shared/jobs";
import { repos, type Database } from "@apptrack/db";
import { runNormalizeMessage } from "./email-normalize-service.js";
import { classifyAndStoreMessage } from "./email-classify-service.js";
import { matchAndStoreMessage } from "./application-match-service.js";
import { recomputeApplication } from "./application-recompute-service.js";

/**
 * Reprocesses locally stored content only; Gmail is never called. AGENTS.md
 * §11.5. Changed classifications supersede their old event with a new append.
 */
export async function runEmailReprocess(db: Database, rawInput: EmailReprocessJobV1) {
  const input = EmailReprocessJobV1Schema.parse(rawInput);
  if (
    input.targetClassifierVersion &&
    input.targetClassifierVersion !== CLASSIFIER_VERSION
  ) {
    throw new Error("unsupported_classifier_version");
  }

  const messageIds = await repos.emailsRepo.listEmailMessageIds(db, {
    messageIds: input.scope === "message_ids" ? input.messageIds : undefined,
    afterDate: input.scope === "date_range" ? new Date(input.afterDate) : undefined,
    beforeDate:
      input.scope === "date_range" && input.beforeDate
        ? new Date(input.beforeDate)
        : undefined,
  });

  let classified = 0;
  let rematched = 0;
  let eventsReplaced = 0;
  for (const messageId of messageIds) {
    const normalized = await repos.normalizedEmailsRepo.getLatestNormalized(
      db,
      messageId,
    );
    if (!normalized) await runNormalizeMessage(db, messageId);

    const classifiedOut = await classifyAndStoreMessage(db, messageId);
    classified += 1;
    const latest = await repos.classificationRepo.getEffectiveClassification(
      db,
      messageId,
    );
    if (!latest) continue;
    // Prefer the just-written row id when this pass inserted; otherwise the
    // effective overlay still points at the authoritative machine row.
    const classificationResultId = classifiedOut.classificationId || latest.id;

    const activeEvents = await repos.applicationsRepo.listActiveEventsByMessageId(
      db,
      messageId,
    );
    if (activeEvents.length === 0) {
      await matchAndStoreMessage(db, messageId);
      rematched += 1;
      continue;
    }

    for (const event of activeEvents) {
      if (event.classificationResultId === classificationResultId) continue;
      // No event rewrite is needed when the externally visible outcome did not
      // change; the latest classification still remains auditable.
      if (event.eventType === latest.eventType) continue;
      const replacement = await repos.applicationsRepo.appendApplicationEvent(db, {
        applicationId: event.applicationId,
        eventType: latest.eventType,
        occurredAt: event.occurredAt,
        source: "email",
        messageId,
        classificationResultId,
        payload: {
          reprocessedFromEventId: event.id,
          extraction: latest.extraction,
          evidence: latest.evidence,
        },
      });
      await repos.applicationsRepo.markEventSuperseded(db, event.id, replacement.id);
      await recomputeApplication(db, event.applicationId);
      eventsReplaced += 1;
    }
  }

  return {
    classifierVersion: CLASSIFIER_VERSION,
    messages: messageIds.length,
    classified,
    rematched,
    eventsReplaced,
  };
}
