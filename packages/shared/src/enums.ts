/**
 * Shared enums — FR-1 event types. Versioned; breaking changes require V2.
 * AGENTS.md §3 / §13.6
 */
export const EventType = {
  application_confirmation: "application_confirmation",
  oa_invitation: "oa_invitation",
  oa_reminder: "oa_reminder",
  recruiter_outreach: "recruiter_outreach",
  interview_invitation: "interview_invitation",
  interview_scheduled: "interview_scheduled",
  interview_rescheduled: "interview_rescheduled",
  interview_cancelled: "interview_cancelled",
  followup_request: "followup_request",
  info_request: "info_request",
  rejection: "rejection",
  offer: "offer",
  waitlist_or_freeze: "waitlist_or_freeze",
  withdrawal_confirmation: "withdrawal_confirmation",
  duplicate_application_notice: "duplicate_application_notice",
  newsletter_ignore: "newsletter_ignore",
  unknown: "unknown",
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const ApplicationState = {
  draft: "draft",
  applied: "applied",
  confirmation_received: "confirmation_received",
  assessment_received: "assessment_received",
  assessment_completed: "assessment_completed",
  recruiter_screen: "recruiter_screen",
  interviewing: "interviewing",
  final_round: "final_round",
  offer: "offer",
  rejected: "rejected",
  withdrawn: "withdrawn",
  ghosted: "ghosted",
  on_hold: "on_hold",
  unknown: "unknown",
} as const;

export type ApplicationState =
  (typeof ApplicationState)[keyof typeof ApplicationState];

export const ClassifierMode = {
  deterministic: "deterministic",
  local: "local",
  api: "api",
  hybrid: "hybrid",
} as const;

export type ClassifierMode =
  (typeof ClassifierMode)[keyof typeof ClassifierMode];
