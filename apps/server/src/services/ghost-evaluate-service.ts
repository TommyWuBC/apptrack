/**
 * ghost.evaluate — scan applications, advance/clear ghost status. AGENTS.md §17 / M12
 */
import {
  evaluateGhost,
  GHOST_VERSION,
  reduce,
  REDUCER_VERSION,
  type GhostEvaluateInput,
} from "@apptrack/core";
import {
  ApplicationEventType,
  GhostStatus,
  GhostThresholdsV1Schema,
  ReviewKind,
  type GhostThresholdsV1,
} from "@apptrack/shared";
import { repos, type Database } from "@apptrack/db";

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
) {
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

function dismissedAtStateFromEvents(
  rows: Array<{ eventType: string; payload: unknown; supersededBy: string | null }>,
): string | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!;
    if (row.supersededBy) continue;
    if (row.eventType === ApplicationEventType.ghost_dismissed) {
      const p = (row.payload ?? {}) as Record<string, unknown>;
      return typeof p.dismissedAtState === "string" ? p.dismissedAtState : null;
    }
  }
  return null;
}

export type GhostTransition = {
  applicationId: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  evidence: string;
  eventId?: string;
  notificationId?: string;
  reviewItemId?: string;
};

export type EvaluateGhostsResult = {
  algorithmVersion: string;
  scanned: number;
  transitions: GhostTransition[];
};

async function loadGhostSettings(
  db: Database,
  userId: string,
): Promise<GhostThresholdsV1> {
  const row = await repos.settingsRepo.getSettingsForUser(db, userId);
  if (!row) return GhostThresholdsV1Schema.parse({});
  return GhostThresholdsV1Schema.parse(row.ghostThresholds ?? {});
}

/**
 * Apply one evaluate result: append events, update ghost_status, notify.
 * Caller should recompute when events were appended.
 */
async function applyGhostAction(
  db: Database,
  app: {
    id: string;
    userId: string;
    ghostStatus: string;
    currentState: string;
    companyId: string;
  },
  result: ReturnType<typeof evaluateGhost>,
  companyName: string | null,
): Promise<GhostTransition | null> {
  if (result.action === "none" || result.action === "keep_dismissed") {
    return null;
  }

  const fromStatus = app.ghostStatus;
  let eventId: string | undefined;
  let notificationId: string | undefined;
  let reviewItemId: string | undefined;

  if (result.action === "mark_stale") {
    const ev = await repos.applicationsRepo.appendApplicationEvent(db, {
      applicationId: app.id,
      eventType: ApplicationEventType.ghost_flagged,
      occurredAt: new Date(),
      source: "system",
      payload: {
        level: "stale",
        daysInactive: result.daysInactive,
        evidence: result.evidence,
        algorithmVersion: result.algorithmVersion,
      },
    });
    eventId = ev.id;
    await repos.applicationsRepo.updateApplicationProjection(db, app.id, {
      ghostStatus: GhostStatus.stale,
    });
  } else if (result.action === "mark_ghosted") {
    const ev = await repos.applicationsRepo.appendApplicationEvent(db, {
      applicationId: app.id,
      eventType: ApplicationEventType.ghost_flagged,
      occurredAt: new Date(),
      source: "system",
      payload: {
        level: "possibly_ghosted",
        daysInactive: result.daysInactive,
        evidence: result.evidence,
        algorithmVersion: result.algorithmVersion,
      },
    });
    eventId = ev.id;
    await repos.applicationsRepo.updateApplicationProjection(db, app.id, {
      ghostStatus: GhostStatus.possibly_ghosted,
    });

    const link = `/applications/${app.id}`;
    const existing = await repos.notificationsRepo.findRecentNotification(
      db,
      app.userId,
      "ghost_flagged",
      link,
    );
    if (!existing) {
      const n = await repos.notificationsRepo.createNotification(db, {
        userId: app.userId,
        kind: "ghost_flagged",
        title: "Possibly ghosted application",
        body: `${companyName ?? "Application"}: ${result.evidence}`,
        link,
      });
      notificationId = n.id;
    } else {
      notificationId = existing.id;
    }

    const open = await repos.matchingRepo.listOpenReviewItems(db, {
      kind: ReviewKind.ghost_confirm,
      refId: app.id,
    });
    if (open[0]) {
      reviewItemId = open[0].id;
    } else {
      const item = await repos.matchingRepo.createReviewItem(db, {
        kind: ReviewKind.ghost_confirm,
        refId: app.id,
        resolution: {
          evidence: result.evidence,
          daysInactive: result.daysInactive,
          algorithmVersion: result.algorithmVersion,
        },
      });
      reviewItemId = item.id;
    }
  } else if (result.action === "clear") {
    const ev = await repos.applicationsRepo.appendApplicationEvent(db, {
      applicationId: app.id,
      eventType: ApplicationEventType.ghost_cleared,
      occurredAt: new Date(),
      source: "system",
      payload: {
        previousStatus: fromStatus,
        evidence: result.evidence,
        algorithmVersion: result.algorithmVersion,
      },
    });
    eventId = ev.id;
    await repos.applicationsRepo.updateApplicationProjection(db, app.id, {
      ghostStatus: GhostStatus.none,
    });
  }

  return {
    applicationId: app.id,
    action: result.action,
    fromStatus,
    toStatus: result.nextStatus,
    evidence: result.evidence,
    eventId,
    notificationId,
    reviewItemId,
  };
}

/**
 * Evaluate a single application (used by daily job and recompute clear path).
 */
export async function evaluateApplicationGhost(
  db: Database,
  applicationId: string,
  opts: { now?: Date; apply?: boolean } = {},
): Promise<{
  result: ReturnType<typeof evaluateGhost>;
  transition: GhostTransition | null;
}> {
  const app = await repos.applicationsRepo.getApplicationById(db, applicationId);
  if (!app) throw new Error("application_not_found");

  const rows = await repos.applicationsRepo.listEventsForApplication(
    db,
    applicationId,
  );
  const reduced = reduce(toReducerEvents(rows), REDUCER_VERSION, {
    now: opts.now,
  });
  const settings = await loadGhostSettings(db, app.userId);

  const input: GhostEvaluateInput = {
    currentGhostStatus: app.ghostStatus,
    currentState: app.currentState,
    lastMeaningfulAt: reduced.ghostInputs.lastMeaningfulAt,
    appliedAt: app.appliedAt,
    hasFutureScheduled: reduced.ghostInputs.hasFutureScheduled,
    terminal: reduced.ghostInputs.terminal,
    dismissedAtState: dismissedAtStateFromEvents(rows),
    now: opts.now,
    settings,
    companyId: app.companyId,
  };

  const result = evaluateGhost(input);
  if (opts.apply === false) {
    return { result, transition: null };
  }

  const company = await repos.applicationsRepo.getCompanyById(db, app.companyId);
  const transition = await applyGhostAction(
    db,
    app,
    result,
    company?.canonicalName ?? null,
  );

  // Recompute projection when events changed current_state path
  if (
    transition &&
    (result.action === "mark_ghosted" || result.action === "clear")
  ) {
    const { recomputeApplication } = await import(
      "./application-recompute-service.js"
    );
    await recomputeApplication(db, applicationId, {
      skipGhostEvaluate: true,
    });
  }

  return { result, transition };
}

/**
 * Daily scan: evaluate all applications for a user (or first owner).
 * Idempotent — re-running same day yields no duplicate transitions. §23
 */
export async function evaluateGhostsForUser(
  db: Database,
  userId: string,
  opts: { now?: Date } = {},
): Promise<EvaluateGhostsResult> {
  const apps = await repos.applicationsRepo.listApplicationsForUser(db, userId);
  const transitions: GhostTransition[] = [];

  for (const app of apps) {
    const { transition } = await evaluateApplicationGhost(db, app.id, {
      now: opts.now,
    });
    if (transition) transitions.push(transition);
  }

  return {
    algorithmVersion: GHOST_VERSION,
    scanned: apps.length,
    transitions,
  };
}

/**
 * User dismisses ghost inference. §17
 */
export async function dismissGhost(
  db: Database,
  applicationId: string,
  opts: { userId?: string } = {},
) {
  const app = await repos.applicationsRepo.getApplicationById(db, applicationId);
  if (!app) throw new Error("application_not_found");

  const priorState =
    app.currentState === "ghosted"
      ? // Will pop via reducer; store pre-ghost stage from events if possible
        app.currentState
      : app.currentState;

  // Prefer the state before ghost projection for suppress-until-change.
  const rows = await repos.applicationsRepo.listEventsForApplication(
    db,
    applicationId,
  );
  const reduced = reduce(toReducerEvents(rows), REDUCER_VERSION);
  // If already ghosted, dismissedAtState should be the stage before ghost_flagged
  let dismissedAtState = priorState;
  if (app.currentState === "ghosted" || app.ghostStatus === GhostStatus.possibly_ghosted) {
    const timeline = reduced.stateTimeline;
    const beforeGhost = [...timeline]
      .reverse()
      .find((e) => e.state !== "ghosted");
    dismissedAtState = beforeGhost?.state ?? priorState;
  }

  const ev = await repos.applicationsRepo.appendApplicationEvent(db, {
    applicationId,
    eventType: ApplicationEventType.ghost_dismissed,
    occurredAt: new Date(),
    source: "user",
    payload: {
      dismissedAtState,
      previousGhostStatus: app.ghostStatus,
    },
  });

  await repos.applicationsRepo.updateApplicationProjection(db, applicationId, {
    ghostStatus: GhostStatus.dismissed,
  });

  const { recomputeApplication } = await import(
    "./application-recompute-service.js"
  );
  const recomputed = await recomputeApplication(db, applicationId, {
    skipGhostEvaluate: true,
  });

  await repos.correctionsRepo.writeAuditLog(db, {
    userId: opts.userId ?? app.userId,
    actor: "user",
    action: "ghost.dismiss",
    targetType: "application",
    targetId: applicationId,
    metadata: { eventId: ev.id, dismissedAtState },
  });

  // Close open ghost_confirm review items
  const open = await repos.matchingRepo.listOpenReviewItems(db, {
    kind: ReviewKind.ghost_confirm,
    refId: applicationId,
  });
  for (const item of open) {
    await repos.matchingRepo.dismissReviewItem(db, item.id, {
      via: "ghost_dismissed",
      eventId: ev.id,
    });
  }

  return {
    applicationId,
    eventId: ev.id,
    ghostStatus: GhostStatus.dismissed,
    dismissedAtState,
    recomputed,
  };
}

export { loadGhostSettings, dismissedAtStateFromEvents, GHOST_VERSION };
