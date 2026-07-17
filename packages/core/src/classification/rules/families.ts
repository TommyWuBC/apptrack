/**
 * L2 deterministic keyword rules. AGENTS.md §13.1
 * Data-driven: patterns / antiPatterns / weight.
 */
import { EventType } from "@apptrack/shared";

export type RuleDef = {
  id: string;
  eventType: EventType;
  /** Case-insensitive substring or RegExp source matched against subject+body */
  patterns: string[];
  antiPatterns?: string[];
  weight: number;
  evidenceTemplate: string;
};

export const RULES: RuleDef[] = [
  {
    id: "R-CONF-1",
    eventType: EventType.application_confirmation,
    patterns: [
      "thanks for applying",
      "received your application",
      "application received",
    ],
    antiPatterns: ["not be moving forward", "pleased to offer"],
    weight: 0.92,
    evidenceTemplate: "Application-confirmation phrasing (rule R-CONF-1)",
  },
  {
    id: "R-OA-INV-1",
    eventType: EventType.oa_invitation,
    patterns: [
      "online assessment",
      "invited you to complete an online assessment",
      "assessment invitation",
    ],
    antiPatterns: ["reminder:", "due soon"],
    weight: 0.92,
    evidenceTemplate: "OA invitation phrasing (rule R-OA-INV-1)",
  },
  {
    id: "R-OA-REM-1",
    eventType: EventType.oa_reminder,
    patterns: [
      "reminder: your",
      "assessment for",
      "complete your",
      "due soon",
    ],
    antiPatterns: [],
    weight: 0.88,
    evidenceTemplate: "OA reminder phrasing (rule R-OA-REM-1)",
  },
  {
    id: "R-INT-INV-1",
    eventType: EventType.interview_invitation,
    patterns: [
      "invite you to interview",
      "interview invitation",
      "please pick a time",
    ],
    antiPatterns: ["is confirmed", "has been moved", "has been cancelled"],
    weight: 0.92,
    evidenceTemplate: "Interview invitation phrasing (rule R-INT-INV-1)",
  },
  {
    id: "R-INT-SCHED-1",
    eventType: EventType.interview_scheduled,
    patterns: [
      "interview confirmed",
      "is confirmed for",
      "your interview for",
    ],
    antiPatterns: ["has been moved", "has been cancelled", "invite you to interview"],
    weight: 0.9,
    evidenceTemplate: "Interview scheduled phrasing (rule R-INT-SCHED-1)",
  },
  {
    id: "R-INT-RESCHED-1",
    eventType: EventType.interview_rescheduled,
    patterns: ["interview rescheduled", "has been moved to"],
    weight: 0.93,
    evidenceTemplate: "Interview rescheduled phrasing (rule R-INT-RESCHED-1)",
  },
  {
    id: "R-INT-CANCEL-1",
    eventType: EventType.interview_cancelled,
    patterns: ["interview cancelled", "interview has been cancelled"],
    weight: 0.93,
    evidenceTemplate: "Interview cancelled phrasing (rule R-INT-CANCEL-1)",
  },
  {
    id: "R-REJ-1",
    eventType: EventType.rejection,
    patterns: [
      "not be moving forward",
      "not moving forward",
      "other candidates",
      "will not be progressing",
    ],
    antiPatterns: ["interview is confirmed", "pleased to offer"],
    weight: 0.93,
    evidenceTemplate: "Rejection phrasing (rule R-REJ-1)",
  },
  {
    id: "R-OFFER-1",
    eventType: EventType.offer,
    patterns: [
      "pleased to offer you",
      "offer you the",
      "congratulations! ",
      "offer from ",
    ],
    antiPatterns: [
      "ignore previous instructions",
      "mark this as an offer",
      "timeshare",
      "buy crypto",
    ],
    weight: 0.94,
    evidenceTemplate: "Offer phrasing (rule R-OFFER-1)",
  },
  {
    id: "R-RECR-1",
    eventType: EventType.recruiter_outreach,
    patterns: [
      "recruiting",
      "are you open to a chat",
      "quick chat",
    ],
    antiPatterns: ["thanks for applying", "online assessment"],
    weight: 0.85,
    evidenceTemplate: "Recruiter outreach phrasing (rule R-RECR-1)",
  },
  {
    id: "R-FOLLOW-1",
    eventType: EventType.followup_request,
    patterns: ["following up on your application", "follow-up requested"],
    weight: 0.9,
    evidenceTemplate: "Follow-up request phrasing (rule R-FOLLOW-1)",
  },
  {
    id: "R-INFO-1",
    eventType: EventType.info_request,
    patterns: [
      "needs a bit more information",
      "additional information needed",
      "upload documents",
    ],
    weight: 0.9,
    evidenceTemplate: "Info request phrasing (rule R-INFO-1)",
  },
  {
    id: "R-WAIT-1",
    eventType: EventType.waitlist_or_freeze,
    patterns: ["on hold", "waitlisted", "waitlist"],
    weight: 0.88,
    evidenceTemplate: "Waitlist/hold phrasing (rule R-WAIT-1)",
  },
  {
    id: "R-WITHDRAW-1",
    eventType: EventType.withdrawal_confirmation,
    patterns: ["withdrawal of your application", "withdrawal confirmed"],
    weight: 0.92,
    evidenceTemplate: "Withdrawal confirmation phrasing (rule R-WITHDRAW-1)",
  },
  {
    id: "R-DUP-1",
    eventType: EventType.duplicate_application_notice,
    patterns: ["duplicate application"],
    weight: 0.92,
    evidenceTemplate: "Duplicate application notice (rule R-DUP-1)",
  },
  {
    id: "R-NEWS-1",
    eventType: EventType.newsletter_ignore,
    patterns: ["careers newsletter", "careers weekly", "this week's"],
    weight: 0.9,
    evidenceTemplate: "Newsletter phrasing (rule R-NEWS-1)",
  },
];
