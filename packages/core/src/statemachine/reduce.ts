/**
 * Pure application state reducer. AGENTS.md §16
 * Events are the source of truth; current_state is a projection (INV-9).
 */
import {
  ApplicationEventType,
  ApplicationState,
  EventType,
  ReduceResultV1Schema,
  type ReduceResultV1,
  type ReducerEventV1,
  type StateTimelineEntryV1,
} from "@apptrack/shared";
import { orderEvents, utcDayKey } from "./order.js";
import { REDUCER_VERSION } from "./version.js";

const TERMINAL = new Set<string>([
  ApplicationState.offer,
  ApplicationState.rejected,
  ApplicationState.withdrawn,
]);

const MEANINGFUL = new Set<string>([
  EventType.application_confirmation,
  EventType.oa_invitation,
  EventType.oa_reminder,
  EventType.recruiter_outreach,
  EventType.interview_invitation,
  EventType.interview_scheduled,
  EventType.interview_rescheduled,
  EventType.interview_cancelled,
  EventType.followup_request,
  EventType.info_request,
  EventType.rejection,
  EventType.offer,
  EventType.waitlist_or_freeze,
  EventType.withdrawal_confirmation,
  ApplicationEventType.manual_override,
  ApplicationEventType.created_manually,
  ApplicationEventType.match_reassigned,
]);

const INTERVIEW_POSITIVE = new Set<string>([
  EventType.interview_invitation,
  EventType.interview_scheduled,
  EventType.interview_rescheduled,
]);

function isFinalRoundHint(payload: Record<string, unknown> | undefined): boolean {
  if (!payload) return false;
  const stage = String(payload.stage ?? "").toLowerCase();
  const format = String(payload.interviewFormat ?? "").toLowerCase();
  return (
    stage.includes("final") ||
    format.includes("final") ||
    payload.finalRound === true
  );
}

function hasFutureScheduled(
  events: ReducerEventV1[],
  now: Date,
): boolean {
  for (const e of events) {
    const p = e.payload ?? {};
    for (const key of ["interviewDatetime", "assessmentDeadline", "deadline"]) {
      const raw = p[key];
      if (typeof raw === "string") {
        const t = Date.parse(raw);
        if (!Number.isNaN(t) && t > now.getTime()) return true;
      }
    }
  }
  return false;
}

function sameDayConflict(ordered: ReducerEventV1[]): boolean {
  const byDay = new Map<string, Set<string>>();
  for (const e of ordered) {
    const day = utcDayKey(e.occurredAt);
    const set = byDay.get(day) ?? new Set();
    set.add(e.eventType);
    byDay.set(day, set);
  }
  for (const types of byDay.values()) {
    const hasReject = types.has(EventType.rejection);
    const hasInterview = [...types].some((t) => INTERVIEW_POSITIVE.has(t));
    const hasOffer = types.has(EventType.offer);
    if (hasReject && (hasInterview || hasOffer)) return true;
  }
  return false;
}

type Step = {
  state: string;
  actionRequired: boolean;
  reopened: boolean;
  onHold: boolean;
  stack: string[];
};

function initialStep(): Step {
  return {
    state: ApplicationState.draft,
    actionRequired: false,
    reopened: false,
    onHold: false,
    stack: [ApplicationState.draft],
  };
}

function pushState(step: Step, next: string): void {
  if (step.state !== next) {
    step.stack.push(next);
    step.state = next;
  }
}

function popToPriorStage(step: Step): void {
  if (step.stack.length > 1) {
    step.stack.pop();
    step.state = step.stack[step.stack.length - 1] ?? ApplicationState.unknown;
  }
}

/**
 * Apply one event to the current step. Exhaustive on known types.
 * // AGENTS.md §16.3
 */
function applyEvent(step: Step, event: ReducerEventV1): void {
  const t = event.eventType;
  const payload = event.payload ?? {};
  const wasTerminal = TERMINAL.has(step.state);

  switch (t) {
    case ApplicationEventType.created_manually:
    case EventType.application_confirmation:
    case EventType.duplicate_application_notice: {
      if (step.state === ApplicationState.draft) {
        pushState(step, ApplicationState.applied);
      }
      if (
        t === EventType.application_confirmation ||
        t === EventType.duplicate_application_notice
      ) {
        pushState(step, ApplicationState.confirmation_received);
      }
      break;
    }
    case EventType.oa_invitation:
    case EventType.oa_reminder: {
      if (wasTerminal) step.reopened = true;
      pushState(step, ApplicationState.assessment_received);
      if (t === EventType.oa_invitation) step.actionRequired = true;
      break;
    }
    case EventType.recruiter_outreach: {
      if (wasTerminal) step.reopened = true;
      pushState(step, ApplicationState.recruiter_screen);
      break;
    }
    case EventType.interview_invitation:
    case EventType.interview_scheduled:
    case EventType.interview_rescheduled: {
      if (wasTerminal) step.reopened = true;
      if (isFinalRoundHint(payload)) {
        pushState(step, ApplicationState.final_round);
      } else {
        pushState(step, ApplicationState.interviewing);
      }
      if (t === EventType.interview_invitation) step.actionRequired = true;
      step.onHold = false;
      break;
    }
    case EventType.interview_cancelled: {
      // Fall back to prior stage without reschedule (§16.3)
      if (
        step.state === ApplicationState.interviewing ||
        step.state === ApplicationState.final_round
      ) {
        popToPriorStage(step);
      }
      break;
    }
    case EventType.followup_request:
    case EventType.info_request: {
      step.actionRequired = true;
      break;
    }
    case EventType.rejection: {
      pushState(step, ApplicationState.rejected);
      step.actionRequired = false;
      step.onHold = false;
      break;
    }
    case EventType.offer: {
      if (wasTerminal && step.state === ApplicationState.rejected) {
        step.reopened = true;
      }
      pushState(step, ApplicationState.offer);
      step.actionRequired = true;
      step.onHold = false;
      break;
    }
    case EventType.waitlist_or_freeze: {
      pushState(step, ApplicationState.on_hold);
      step.onHold = true;
      break;
    }
    case EventType.withdrawal_confirmation: {
      pushState(step, ApplicationState.withdrawn);
      step.actionRequired = false;
      step.onHold = false;
      break;
    }
    case ApplicationEventType.manual_override: {
      const next = payload.state ?? payload.currentState;
      if (typeof next === "string" && next.length > 0) {
        if (TERMINAL.has(step.state) && !TERMINAL.has(next)) {
          step.reopened = true;
        }
        pushState(step, next);
      }
      if (typeof payload.actionRequired === "boolean") {
        step.actionRequired = payload.actionRequired;
      }
      break;
    }
    case ApplicationEventType.ghost_flagged: {
      // Stale flags are auditable events but do not change current_state.
      // possibly_ghosted (default) projects to ApplicationState.ghosted. §17
      const level = payload.level ?? "possibly_ghosted";
      if (level === "possibly_ghosted" && !TERMINAL.has(step.state)) {
        pushState(step, ApplicationState.ghosted);
      }
      break;
    }
    case ApplicationEventType.ghost_dismissed:
    case ApplicationEventType.ghost_cleared: {
      if (step.state === ApplicationState.ghosted) {
        popToPriorStage(step);
      }
      break;
    }
    case ApplicationEventType.match_reassigned:
    case EventType.newsletter_ignore:
    case EventType.unknown:
      break;
    default: {
      // Unknown future event types: do not crash; leave state unchanged.
      break;
    }
  }

  // Assessment completed heuristic: OA reminder after invitation already in assessment
  if (
    t === EventType.oa_reminder &&
    step.state === ApplicationState.assessment_received &&
    payload.completed === true
  ) {
    pushState(step, ApplicationState.assessment_completed);
    step.actionRequired = false;
  }
}

/**
 * Replay ordered events into a projection.
 * // AGENTS.md §16.3
 */
export function reduce(
  events: ReducerEventV1[],
  reducerVersion: string = REDUCER_VERSION,
  opts: { now?: Date } = {},
): ReduceResultV1 {
  const ordered = orderEvents(events);
  const now = opts.now ?? new Date();
  const step = initialStep();
  const stateTimeline: StateTimelineEntryV1[] = [];

  // Seed timeline if we start from draft with no events
  if (ordered.length === 0) {
    const result = {
      state: ApplicationState.draft,
      stateTimeline: [],
      actionRequired: false,
      flags: { conflict: false, reopened: false, onHold: false },
      ghostInputs: {
        lastMeaningfulAt: null,
        hasFutureScheduled: false,
        terminal: false,
      },
      reducerVersion,
    };
    return ReduceResultV1Schema.parse(result);
  }

  // If first event implies applied (confirmation), draft→applied is implicit in applyEvent
  for (const event of ordered) {
    const before = step.state;
    applyEvent(step, event);
    if (step.state !== before || stateTimeline.length === 0) {
      stateTimeline.push({
        state: step.state,
        at: event.occurredAt,
        eventId: event.id,
        eventType: event.eventType,
      });
    }
  }

  let lastMeaningfulAt: Date | null = null;
  for (const e of ordered) {
    if (MEANINGFUL.has(e.eventType)) {
      lastMeaningfulAt = e.occurredAt;
    }
  }

  const conflict = sameDayConflict(ordered);
  const terminal = TERMINAL.has(step.state);

  const result: ReduceResultV1 = {
    state: step.state,
    stateTimeline,
    actionRequired: step.actionRequired,
    flags: {
      conflict,
      reopened: step.reopened,
      onHold: step.onHold || step.state === ApplicationState.on_hold,
    },
    ghostInputs: {
      lastMeaningfulAt,
      hasFutureScheduled: hasFutureScheduled(ordered, now),
      terminal,
    },
    reducerVersion,
  };

  return ReduceResultV1Schema.parse(result);
}

export { REDUCER_VERSION, MEANINGFUL, TERMINAL };
