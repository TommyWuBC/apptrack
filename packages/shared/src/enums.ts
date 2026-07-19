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

export type ApplicationState = (typeof ApplicationState)[keyof typeof ApplicationState];

export const ClassifierMode = {
  deterministic: "deterministic",
  local: "local",
  api: "api",
  hybrid: "hybrid",
} as const;

export type ClassifierMode = (typeof ClassifierMode)[keyof typeof ClassifierMode];

/** Application match decisions. AGENTS.md §15.2 */
export const MatchDecision = {
  auto_attached: "auto_attached",
  review: "review",
  rejected: "rejected",
  new_application: "new_application",
} as const;

export type MatchDecision = (typeof MatchDecision)[keyof typeof MatchDecision];

/** Review queue item kinds. AGENTS.md §10.5 / §18.3 */
export const ReviewKind = {
  uncertain_classification: "uncertain_classification",
  ambiguous_match: "ambiguous_match",
  entity_merge_suggestion: "entity_merge_suggestion",
  ghost_confirm: "ghost_confirm",
  unmatched_email: "unmatched_email",
  /** Conflicting same-day events (e.g. reject + interview). §16.4 F14 */
  state_conflict: "state_conflict",
} as const;

export type ReviewKind = (typeof ReviewKind)[keyof typeof ReviewKind];

/**
 * Timeline event types = FR-1 + system/user control events. AGENTS.md §10.4
 */
export const ApplicationEventType = {
  ...EventType,
  manual_override: "manual_override",
  match_reassigned: "match_reassigned",
  created_manually: "created_manually",
  ghost_flagged: "ghost_flagged",
  ghost_dismissed: "ghost_dismissed",
  ghost_cleared: "ghost_cleared",
} as const;

export type ApplicationEventType =
  (typeof ApplicationEventType)[keyof typeof ApplicationEventType];

/** Projection ghost inference status. AGENTS.md §10.4 / §17 */
export const GhostStatus = {
  none: "none",
  stale: "stale",
  possibly_ghosted: "possibly_ghosted",
  dismissed: "dismissed",
} as const;

export type GhostStatus = (typeof GhostStatus)[keyof typeof GhostStatus];

/** Analytics site modes. AGENTS.md §20.3 */
export const AnalyticsSiteMode = {
  full: "full",
  no_geo: "no_geo",
  off: "off",
} as const;

export type AnalyticsSiteMode =
  (typeof AnalyticsSiteMode)[keyof typeof AnalyticsSiteMode];

/** Allowlisted analytics event types. AGENTS.md §20.4 / §10.6 */
export const AnalyticsEventType = {
  page_view: "page_view",
  project_view: "project_view",
  resume_view: "resume_view",
  resume_download: "resume_download",
  github_click: "github_click",
  contact_click: "contact_click",
  session_start: "session_start",
  session_end: "session_end",
  custom: "custom",
} as const;

export type AnalyticsEventType =
  (typeof AnalyticsEventType)[keyof typeof AnalyticsEventType];
