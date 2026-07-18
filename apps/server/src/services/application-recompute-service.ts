/**
 * application.recompute — replay events → projection. AGENTS.md §16.5 / M9
 * Idempotent by construction (INV-9).
 */
import {
  applyCorrections,
  reduce,
  REDUCER_VERSION,
  type UserCorrection,
} from "@apptrack/core";
import { ReviewKind, type ReducerEventV1 } from "@apptrack/shared";
import { repos, type Database } from "@apptrack/db";

const { applicationsRepo, matchingRepo } = repos;

function toReducerEvents(
  rows: Array<{
    id: string;
    eventType: string;
    occurredAt: Date;
    ingestedAt: Date;
    source: string;
    messageId: string | null;
    classificationResultId: string | null;
    payload: unknown;
    supersededBy: string | null;
  }>,
): ReducerEventV1[] {
  return rows.map((r) => ({
    id: r.id,
    eventType: r.eventType,
    occurredAt: r.occurredAt,
    ingestedAt: r.ingestedAt,
    source: (r.source as "email" | "user" | "system") ?? "email",
    messageId: r.messageId,
    classificationResultId: r.classificationResultId,
    payload: (r.payload as Record<string, unknown>) ?? {},
    supersededBy: r.supersededBy,
  }));
}

export type RecomputeResult = {
  applicationId: string;
  state: string;
  actionRequired: boolean;
  reducerVersion: string;
  flags: { conflict: boolean; reopened: boolean; onHold: boolean };
  conflictReviewItemId: string | null;
};

/**
 * Load events, reduce, overlay corrections stub, write projection.
 * // AGENTS.md §16.5
 */
export async function recomputeApplication(
  db: Database,
  applicationId: string,
  opts: { corrections?: UserCorrection[] } = {},
): Promise<RecomputeResult> {
  const app = await applicationsRepo.getApplicationById(db, applicationId);
  if (!app) throw new Error("application_not_found");

  const rows = await applicationsRepo.listEventsForApplication(
    db,
    applicationId,
  );
  const reduced = reduce(toReducerEvents(rows), REDUCER_VERSION);

  const overlaid = applyCorrections(
    {
      currentState: reduced.state,
      actionRequired: reduced.actionRequired,
    },
    opts.corrections ?? [],
  );

  const currentState = String(overlaid.currentState);
  const actionRequired = Boolean(overlaid.actionRequired);

  await applicationsRepo.updateApplicationProjection(db, applicationId, {
    currentState,
    actionRequired,
    stateVersion: reduced.reducerVersion,
  });

  // Keep last_event_at aligned with meaningful activity (out-of-order safe)
  if (reduced.ghostInputs.lastMeaningfulAt) {
    await applicationsRepo.touchLastEventAt(
      db,
      applicationId,
      reduced.ghostInputs.lastMeaningfulAt,
    );
  }

  let conflictReviewItemId: string | null = null;
  if (reduced.flags.conflict) {
    const existing = await matchingRepo.listOpenReviewItems(db, {
      kind: ReviewKind.state_conflict,
      refId: applicationId,
    });
    if (existing[0]) {
      conflictReviewItemId = existing[0].id;
    } else {
      const item = await matchingRepo.createReviewItem(db, {
        kind: ReviewKind.state_conflict,
        refId: applicationId,
        resolution: {
          flags: reduced.flags,
          state: currentState,
          reducerVersion: reduced.reducerVersion,
        },
      });
      conflictReviewItemId = item.id;
    }
  }

  return {
    applicationId,
    state: currentState,
    actionRequired,
    reducerVersion: reduced.reducerVersion,
    flags: reduced.flags,
    conflictReviewItemId,
  };
}

/** Build timeline DTO: ordered events + reduce result. */
export async function getApplicationTimeline(
  db: Database,
  applicationId: string,
) {
  const app = await applicationsRepo.getApplicationById(db, applicationId);
  if (!app) return null;

  const rows = await applicationsRepo.listEventsForApplication(
    db,
    applicationId,
  );
  const events = toReducerEvents(rows);
  const reduced = reduce(events, app.stateVersion ?? REDUCER_VERSION);

  return {
    applicationId,
    currentState: app.currentState,
    stateVersion: app.stateVersion,
    actionRequired: app.actionRequired,
    ghostStatus: app.ghostStatus,
    appliedAt: app.appliedAt,
    lastEventAt: app.lastEventAt,
    reduce: reduced,
    events: rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      occurredAt: r.occurredAt,
      ingestedAt: r.ingestedAt,
      source: r.source,
      messageId: r.messageId,
      classificationResultId: r.classificationResultId,
      payload: r.payload,
      supersededBy: r.supersededBy,
      createdAt: r.createdAt,
    })),
  };
}
