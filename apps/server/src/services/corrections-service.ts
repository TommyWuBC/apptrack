/**
 * Manual corrections, review resolve, merge/split/reattach. AGENTS.md §18 / M11
 */
import { ApplicationEventType, ReviewKind } from "@apptrack/shared";
import { repos, type Database } from "@apptrack/db";
import { recomputeApplication } from "./application-recompute-service.js";
import { matchAndStoreMessage } from "./application-match-service.js";

const {
  applicationsRepo,
  correctionsRepo,
  matchingRepo,
  classificationRepo,
} = repos;

function toUserCorrections(
  rows: Array<{
    id: string;
    field: string;
    machineValue: unknown;
    userValue: unknown;
    locked: boolean;
    revertedAt: Date | null;
    createdAt: Date;
  }>,
) {
  return rows.map((r) => ({
    id: r.id,
    field: r.field,
    machineValue: r.machineValue,
    userValue: r.userValue,
    locked: r.locked,
    revertedAt: r.revertedAt,
    createdAt: r.createdAt,
  }));
}

export async function loadApplicationCorrections(
  db: Database,
  applicationId: string,
) {
  const rows = await correctionsRepo.listCorrectionsForTarget(
    db,
    "application",
    applicationId,
  );
  return toUserCorrections(rows);
}

/**
 * Apply field corrections (PATCH). Each field → user_corrections row.
 * State changes also append manual_override event.
 * // AGENTS.md §18.1–18.2
 */
export async function patchApplication(
  db: Database,
  applicationId: string,
  patch: {
    fields?: Array<{
      field: string;
      userValue: unknown;
      locked?: boolean;
    }>;
    userId?: string;
    expectedVersion?: string;
  },
) {
  const app = await applicationsRepo.getApplicationById(db, applicationId);
  if (!app) throw new Error("application_not_found");

  if (
    patch.expectedVersion &&
    app.stateVersion &&
    patch.expectedVersion !== app.stateVersion
  ) {
    throw Object.assign(new Error("version_conflict"), { code: "CONFLICT" });
  }

  const created: string[] = [];
  for (const f of patch.fields ?? []) {
    const machineValue =
      f.field === "currentState"
        ? app.currentState
        : f.field === "actionRequired"
          ? app.actionRequired
          : null;

    const row = await correctionsRepo.insertCorrection(db, {
      targetType: "application",
      targetId: applicationId,
      field: f.field,
      machineValue,
      userValue: f.userValue,
      locked: f.locked ?? false,
    });
    created.push(row.id);

    if (f.field === "currentState" && typeof f.userValue === "string") {
      await applicationsRepo.appendApplicationEvent(db, {
        applicationId,
        eventType: ApplicationEventType.manual_override,
        occurredAt: new Date(),
        source: "user",
        payload: {
          state: f.userValue,
          correctionId: row.id,
        },
      });
    }
  }

  await correctionsRepo.writeAuditLog(db, {
    userId: patch.userId,
    actor: "user",
    action: "application.patch",
    targetType: "application",
    targetId: applicationId,
    metadata: { correctionIds: created, fields: patch.fields },
  });

  const corrections = await loadApplicationCorrections(db, applicationId);
  const recomputed = await recomputeApplication(db, applicationId, {
    corrections,
  });

  return { correctionIds: created, recomputed };
}

export async function undoCorrection(
  db: Database,
  correctionId: string,
  userId?: string,
) {
  const existing = await correctionsRepo.getCorrectionById(db, correctionId);
  if (!existing) throw new Error("correction_not_found");
  if (existing.revertedAt) {
    return { correction: existing, alreadyReverted: true };
  }
  const reverted = await correctionsRepo.revertCorrection(db, correctionId);
  await correctionsRepo.writeAuditLog(db, {
    userId,
    actor: "user",
    action: "correction.undo",
    targetType: existing.targetType,
    targetId: existing.targetId,
    metadata: { correctionId, field: existing.field },
  });

  if (existing.targetType === "application") {
    const corrections = await loadApplicationCorrections(
      db,
      existing.targetId,
    );
    await recomputeApplication(db, existing.targetId, { corrections });
  }

  return { correction: reverted, alreadyReverted: false };
}

/**
 * Reattach an event to another application: new event + superseded_by on old.
 */
export async function reattachEvent(
  db: Database,
  eventId: string,
  toApplicationId: string,
  userId?: string,
) {
  const event = await applicationsRepo.getEventById(db, eventId);
  if (!event) throw new Error("event_not_found");
  if (event.supersededBy) throw new Error("event_already_superseded");

  const target = await applicationsRepo.getApplicationById(db, toApplicationId);
  if (!target) throw new Error("application_not_found");

  const neu = await applicationsRepo.appendApplicationEvent(db, {
    applicationId: toApplicationId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    source: "user",
    messageId: event.messageId ?? undefined,
    classificationResultId: event.classificationResultId ?? undefined,
    payload: {
      ...(typeof event.payload === "object" && event.payload
        ? (event.payload as Record<string, unknown>)
        : {}),
      reattachedFrom: event.applicationId,
      priorEventId: event.id,
    },
  });

  // Also write match_reassigned breadcrumb on source
  await applicationsRepo.appendApplicationEvent(db, {
    applicationId: event.applicationId,
    eventType: ApplicationEventType.match_reassigned,
    occurredAt: new Date(),
    source: "user",
    payload: {
      toApplicationId,
      priorEventId: event.id,
      newEventId: neu.id,
    },
  });

  await applicationsRepo.markEventSuperseded(db, event.id, neu.id);

  await correctionsRepo.writeAuditLog(db, {
    userId,
    actor: "user",
    action: "event.reattach",
    targetType: "application_event",
    targetId: eventId,
    metadata: { toApplicationId, newEventId: neu.id },
  });

  await recomputeApplication(db, event.applicationId, {
    corrections: await loadApplicationCorrections(db, event.applicationId),
  });
  await recomputeApplication(db, toApplicationId, {
    corrections: await loadApplicationCorrections(db, toApplicationId),
  });

  return { priorEventId: event.id, newEventId: neu.id, toApplicationId };
}

/**
 * Merge source applications into survivor: reattach all non-superseded events.
 */
export async function mergeApplications(
  db: Database,
  survivorId: string,
  sourceIds: string[],
  userId?: string,
) {
  const survivor = await applicationsRepo.getApplicationById(db, survivorId);
  if (!survivor) throw new Error("application_not_found");

  const moved: string[] = [];
  for (const sourceId of sourceIds) {
    if (sourceId === survivorId) continue;
    const source = await applicationsRepo.getApplicationById(db, sourceId);
    if (!source) throw new Error(`application_not_found:${sourceId}`);
    if (source.userId !== survivor.userId) {
      throw new Error("merge_user_mismatch");
    }

    const events = await applicationsRepo.listEventsForApplication(
      db,
      sourceId,
    );
    for (const ev of events) {
      if (ev.supersededBy) continue;
      if (ev.eventType === ApplicationEventType.match_reassigned) continue;
      const result = await reattachEvent(db, ev.id, survivorId, userId);
      moved.push(result.newEventId);
    }

    await applicationsRepo.appendApplicationEvent(db, {
      applicationId: sourceId,
      eventType: ApplicationEventType.manual_override,
      occurredAt: new Date(),
      source: "user",
      payload: {
        state: "withdrawn",
        reason: "merged_into",
        survivorId,
      },
    });
    await recomputeApplication(db, sourceId, {
      corrections: await loadApplicationCorrections(db, sourceId),
    });
  }

  await correctionsRepo.writeAuditLog(db, {
    userId,
    actor: "user",
    action: "application.merge",
    targetType: "application",
    targetId: survivorId,
    metadata: { sourceIds, movedEventIds: moved },
  });

  await recomputeApplication(db, survivorId, {
    corrections: await loadApplicationCorrections(db, survivorId),
  });

  return { survivorId, sourceIds, movedEventIds: moved };
}

/**
 * Split selected events into a new application at the same company.
 */
export async function splitApplication(
  db: Database,
  applicationId: string,
  eventIds: string[],
  opts: { userId?: string; roleId?: string } = {},
) {
  const app = await applicationsRepo.getApplicationById(db, applicationId);
  if (!app) throw new Error("application_not_found");

  const neu = await applicationsRepo.createApplication(db, {
    userId: app.userId,
    companyId: app.companyId,
    roleId: opts.roleId ?? app.roleId ?? undefined,
    currentState: "applied",
    appliedAt: app.appliedAt ?? new Date(),
    source: app.source ?? "split",
  });

  await applicationsRepo.appendApplicationEvent(db, {
    applicationId: neu.id,
    eventType: ApplicationEventType.created_manually,
    occurredAt: new Date(),
    source: "user",
    payload: { splitFrom: applicationId, eventIds },
  });

  const moved: string[] = [];
  for (const eventId of eventIds) {
    const ev = await applicationsRepo.getEventById(db, eventId);
    if (!ev || ev.applicationId !== applicationId || ev.supersededBy) continue;
    const result = await reattachEvent(db, eventId, neu.id, opts.userId);
    moved.push(result.newEventId);
  }

  await correctionsRepo.writeAuditLog(db, {
    userId: opts.userId,
    actor: "user",
    action: "application.split",
    targetType: "application",
    targetId: applicationId,
    metadata: { newApplicationId: neu.id, movedEventIds: moved },
  });

  await recomputeApplication(db, applicationId, {
    corrections: await loadApplicationCorrections(db, applicationId),
  });
  await recomputeApplication(db, neu.id, {
    corrections: await loadApplicationCorrections(db, neu.id),
  });

  return { sourceApplicationId: applicationId, newApplicationId: neu.id, moved };
}

/**
 * Merge companies: repoint apps + aliases onto survivor. No silent auto-merge.
 */
export async function mergeCompanies(
  db: Database,
  survivorCompanyId: string,
  sourceCompanyId: string,
  userId?: string,
) {
  if (survivorCompanyId === sourceCompanyId) {
    throw new Error("merge_same_company");
  }
  const survivor = await applicationsRepo.getCompanyById(
    db,
    survivorCompanyId,
  );
  const source = await applicationsRepo.getCompanyById(db, sourceCompanyId);
  if (!survivor || !source) throw new Error("company_not_found");

  await applicationsRepo.reassignApplicationsCompany(
    db,
    sourceCompanyId,
    survivorCompanyId,
  );
  await applicationsRepo.reassignCompanyAliases(
    db,
    sourceCompanyId,
    survivorCompanyId,
  );

  await correctionsRepo.writeAuditLog(db, {
    userId,
    actor: "user",
    action: "company.merge",
    targetType: "company",
    targetId: survivorCompanyId,
    metadata: {
      sourceCompanyId,
      sourceCanonicalName: source.canonicalName,
      survivorCanonicalName: survivor.canonicalName,
    },
  });

  // Close open entity_merge_suggestion items for source
  const open = await matchingRepo.listOpenReviewItems(db, {
    kind: ReviewKind.entity_merge_suggestion,
  });
  for (const item of open) {
    if (
      item.refId === sourceCompanyId ||
      item.refId === survivorCompanyId
    ) {
      await matchingRepo.resolveReviewItem(db, item.id, {
        mergedInto: survivorCompanyId,
        resolvedBy: "user",
      });
    }
  }

  return {
    survivorCompanyId,
    sourceCompanyId,
  };
}

export type ReviewResolution =
  | {
      kind: "ambiguous_match";
      action: "attach";
      applicationId: string;
    }
  | {
      kind: "ambiguous_match";
      action: "new_application";
    }
  | {
      kind: "ambiguous_match";
      action: "dismiss";
    }
  | {
      kind: "entity_merge_suggestion";
      action: "merge";
      survivorCompanyId: string;
      sourceCompanyId: string;
    }
  | {
      kind: "entity_merge_suggestion";
      action: "dismiss";
    }
  | {
      kind: "state_conflict";
      action: "accept_state";
      state: string;
      locked?: boolean;
    }
  | {
      kind: "state_conflict";
      action: "dismiss";
    }
  | {
      kind: "uncertain_classification" | "unmatched_email" | "ghost_confirm";
      action: "dismiss" | "confirm";
    };

/**
 * Resolve a review queue item (tagged union per kind). AGENTS.md §18.3
 */
export async function resolveReview(
  db: Database,
  reviewId: string,
  resolution: ReviewResolution,
  userId?: string,
) {
  const item = await matchingRepo.getReviewItemById(db, reviewId);
  if (!item) throw new Error("review_not_found");
  if (item.status !== "open") throw new Error("review_not_open");

  let detail: Record<string, unknown> = { ...resolution };

  if (resolution.kind === "ambiguous_match") {
    const messageId = item.refId;
    if (resolution.action === "attach") {
      // Create attachment by matching path: load classification and append event
      const classification =
        await classificationRepo.getLatestClassification(db, messageId);
      if (!classification) throw new Error("classification_not_found");
      await applicationsRepo.appendApplicationEvent(db, {
        applicationId: resolution.applicationId,
        eventType: classification.eventType,
        occurredAt: new Date(),
        source: "user",
        messageId,
        classificationResultId: classification.id,
        payload: { resolvedFromReview: reviewId },
      });
      await recomputeApplication(db, resolution.applicationId, {
        corrections: await loadApplicationCorrections(
          db,
          resolution.applicationId,
        ),
      });
    } else if (resolution.action === "new_application") {
      // Force a fresh application from this message's classification
      const out = await matchAndStoreMessage(db, messageId, {
        reevaluate: false,
      });
      // If still review (non-confirmation), create manually via attach to new app
      if (!out.applicationId && out.companyId) {
        const classification =
          await classificationRepo.getLatestClassification(db, messageId);
        if (!classification) throw new Error("classification_not_found");
        const owner = await repos.usersRepo.getFirstUser(db);
        if (!owner) throw new Error("no_user");
        const app = await applicationsRepo.createApplication(db, {
          userId: owner.id,
          companyId: out.companyId,
          currentState: "applied",
          source: "review_resolve",
        });
        await applicationsRepo.appendApplicationEvent(db, {
          applicationId: app.id,
          eventType: classification.eventType,
          occurredAt: new Date(),
          source: "user",
          messageId,
          classificationResultId: classification.id,
          payload: { resolvedFromReview: reviewId },
        });
        await recomputeApplication(db, app.id);
        detail = { ...resolution, applicationId: app.id };
      } else {
        detail = { ...resolution, applicationId: out.applicationId };
      }
    } else {
      await matchingRepo.dismissReviewItem(db, reviewId, resolution);
      await correctionsRepo.writeAuditLog(db, {
        userId,
        actor: "user",
        action: "review.dismiss",
        targetType: "review_queue_item",
        targetId: reviewId,
        metadata: detail,
      });
      return { reviewId, status: "dismissed", detail };
    }
  } else if (resolution.kind === "entity_merge_suggestion") {
    if (resolution.action === "merge") {
      await mergeCompanies(
        db,
        resolution.survivorCompanyId,
        resolution.sourceCompanyId,
        userId,
      );
    } else {
      await matchingRepo.dismissReviewItem(db, reviewId, resolution);
      return { reviewId, status: "dismissed", detail };
    }
  } else if (resolution.kind === "state_conflict") {
    if (resolution.action === "accept_state") {
      await patchApplication(db, item.refId, {
        fields: [
          {
            field: "currentState",
            userValue: resolution.state,
            locked: resolution.locked ?? true,
          },
        ],
        userId,
      });
    } else {
      await matchingRepo.dismissReviewItem(db, reviewId, resolution);
      return { reviewId, status: "dismissed", detail };
    }
  } else if (
    resolution.kind === "ghost_confirm" &&
    resolution.action === "dismiss"
  ) {
    const { dismissGhost } = await import("./ghost-evaluate-service.js");
    await dismissGhost(db, item.refId, { userId });
    await matchingRepo.dismissReviewItem(db, reviewId, resolution);
    await correctionsRepo.writeAuditLog(db, {
      userId,
      actor: "user",
      action: "review.ghost_dismiss",
      targetType: "review_queue_item",
      targetId: reviewId,
      metadata: detail,
    });
    return { reviewId, status: "dismissed", detail };
  } else if (
    resolution.action === "dismiss" ||
    resolution.action === "confirm"
  ) {
    if (resolution.action === "dismiss") {
      await matchingRepo.dismissReviewItem(db, reviewId, resolution);
      return { reviewId, status: "dismissed", detail };
    }
  }

  await matchingRepo.resolveReviewItem(db, reviewId, detail);
  await correctionsRepo.writeAuditLog(db, {
    userId,
    actor: "user",
    action: "review.resolve",
    targetType: "review_queue_item",
    targetId: reviewId,
    metadata: detail,
  });

  return { reviewId, status: "resolved", detail };
}
