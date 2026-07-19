import { ApplicationEventType, EventType } from "@apptrack/shared";
import { repos, type Database } from "@apptrack/db";
import { recomputeApplication } from "./application-recompute-service.js";

/** User override that detaches every active event backed by one email. §18.1 */
export async function markEmailIrrelevant(
  db: Database,
  messageId: string,
  userId: string,
) {
  const message = await repos.emailsRepo.getEmailMessageById(db, messageId);
  if (!message) throw new Error("message_not_found");
  const classification = await repos.classificationRepo.getLatestClassification(
    db,
    messageId,
  );
  if (!classification) throw new Error("classification_not_found");

  const correction = await repos.correctionsRepo.insertCorrection(db, {
    targetType: "classification",
    targetId: classification.id,
    field: "eventType",
    machineValue: classification.eventType,
    userValue: EventType.newsletter_ignore,
    locked: true,
  });

  const activeEvents = await repos.applicationsRepo.listActiveEventsByMessageId(
    db,
    messageId,
  );
  const affected = new Set<string>();
  for (const event of activeEvents) {
    const breadcrumb = await repos.applicationsRepo.appendApplicationEvent(db, {
      applicationId: event.applicationId,
      eventType: ApplicationEventType.match_reassigned,
      occurredAt: new Date(),
      source: "user",
      payload: {
        detachedEventId: event.id,
        messageId,
        reason: "marked_irrelevant",
        correctionId: correction.id,
      },
    });
    await repos.applicationsRepo.markEventSuperseded(db, event.id, breadcrumb.id);
    affected.add(event.applicationId);
  }
  for (const applicationId of affected) {
    await recomputeApplication(db, applicationId);
  }

  const openReviews = await repos.matchingRepo.listOpenReviewItems(db, {
    refId: messageId,
  });
  for (const review of openReviews) {
    await repos.matchingRepo.dismissReviewItem(db, review.id, {
      action: "mark_irrelevant",
      correctionId: correction.id,
    });
  }
  await repos.correctionsRepo.writeAuditLog(db, {
    userId,
    actor: "user",
    action: "email.mark_irrelevant",
    targetType: "email_message",
    targetId: messageId,
    metadata: {
      correctionId: correction.id,
      affectedApplicationIds: [...affected],
    },
  });
  return {
    messageId,
    correctionId: correction.id,
    affectedApplicationIds: [...affected],
  };
}
