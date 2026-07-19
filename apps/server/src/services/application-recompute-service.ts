/**
 * application.recompute — replay events → projection. AGENTS.md §16.5 / M9
 * Idempotent by construction (INV-9).
 * Auto-clears ghost status when meaningful activity returns (§17 / M12).
 */
import {
  applyCorrections,
  evaluateGhost,
  reduce,
  REDUCER_VERSION,
  type UserCorrection,
} from "@apptrack/core";
import {
  ApplicationEventType,
  GhostStatus,
  ReviewKind,
  type ReducerEventV1,
} from "@apptrack/shared";
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
  ghostStatus: string;
  ghostCleared: boolean;
};

/**
 * Load events, reduce, overlay active corrections from DB (INV-7), write projection.
 * When meaningful activity returns, auto-emit ghost_cleared (§17).
 * // AGENTS.md §16.5 / §18.2 / §17
 */
export async function recomputeApplication(
  db: Database,
  applicationId: string,
  opts: {
    corrections?: UserCorrection[];
    /** Skip nested ghost clear to avoid recursion from ghost.evaluate */
    skipGhostEvaluate?: boolean;
  } = {},
): Promise<RecomputeResult> {
  const app = await applicationsRepo.getApplicationById(db, applicationId);
  if (!app) throw new Error("application_not_found");

  let rows = await applicationsRepo.listEventsForApplication(
    db,
    applicationId,
  );
  let reduced = reduce(toReducerEvents(rows), REDUCER_VERSION);
  let ghostCleared = false;

  // Auto-reversal: meaningful activity clears stale / possibly_ghosted. §17
  if (!opts.skipGhostEvaluate) {
    let dismissedAtState: string | null = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]!;
      if (row.supersededBy) continue;
      if (row.eventType === ApplicationEventType.ghost_dismissed) {
        const p = (row.payload ?? {}) as Record<string, unknown>;
        dismissedAtState =
          typeof p.dismissedAtState === "string" ? p.dismissedAtState : null;
        break;
      }
    }

    let settings: Record<string, unknown> = {};
    try {
      const s = await repos.settingsRepo.getSettingsForUser(db, app.userId);
      settings = (s?.ghostThresholds as Record<string, unknown>) ?? {};
    } catch {
      settings = {};
    }

    const ghostResult = evaluateGhost({
      currentGhostStatus: app.ghostStatus,
      currentState: app.currentState,
      lastMeaningfulAt: reduced.ghostInputs.lastMeaningfulAt,
      appliedAt: app.appliedAt,
      hasFutureScheduled: reduced.ghostInputs.hasFutureScheduled,
      terminal: reduced.ghostInputs.terminal,
      dismissedAtState,
      settings,
      companyId: app.companyId,
    });

    if (ghostResult.action === "clear") {
      await applicationsRepo.appendApplicationEvent(db, {
        applicationId,
        eventType: ApplicationEventType.ghost_cleared,
        occurredAt: new Date(),
        source: "system",
        payload: {
          previousStatus: app.ghostStatus,
          evidence: ghostResult.evidence,
          algorithmVersion: ghostResult.algorithmVersion,
        },
      });
      await applicationsRepo.updateApplicationProjection(db, applicationId, {
        ghostStatus: GhostStatus.none,
      });
      ghostCleared = true;
      rows = await applicationsRepo.listEventsForApplication(db, applicationId);
      reduced = reduce(toReducerEvents(rows), REDUCER_VERSION);
    }
  }

  const corrections =
    opts.corrections ??
    (
      await repos.correctionsRepo.listCorrectionsForTarget(
        db,
        "application",
        applicationId,
      )
    ).map((r) => ({
      id: r.id,
      field: r.field,
      machineValue: r.machineValue,
      userValue: r.userValue,
      locked: r.locked,
      revertedAt: r.revertedAt,
      createdAt: r.createdAt,
    }));

  const overlaid = applyCorrections(
    {
      currentState: reduced.state,
      actionRequired: reduced.actionRequired,
    },
    corrections,
  );

  const currentState = String(overlaid.currentState);
  const actionRequired = Boolean(overlaid.actionRequired);
  const fresh = await applicationsRepo.getApplicationById(db, applicationId);
  const ghostStatus = fresh?.ghostStatus ?? app.ghostStatus;

  await applicationsRepo.updateApplicationProjection(db, applicationId, {
    currentState,
    actionRequired,
    stateVersion: reduced.reducerVersion,
    ghostStatus,
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
    ghostStatus,
    ghostCleared,
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
    corrections: (
      await repos.correctionsRepo.listCorrectionsForTarget(
        db,
        "application",
        applicationId,
      )
    ).map((r) => ({
      id: r.id,
      field: r.field,
      machineValue: r.machineValue,
      userValue: r.userValue,
      locked: r.locked,
      revertedAt: r.revertedAt,
      createdAt: r.createdAt,
    })),
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
