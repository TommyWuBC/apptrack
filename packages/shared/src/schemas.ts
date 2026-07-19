import { z } from "zod";
import { EventType } from "./enums.js";

const eventTypeValues = Object.values(EventType) as [string, ...string[]];

/** First-run owner setup and login contracts. AGENTS.md §22. */
export const AuthCredentialsV1Schema = z.object({
  email: z
    .string()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(1024),
});

export type AuthCredentialsV1 = z.infer<typeof AuthCredentialsV1Schema>;

export const AuthMeV1Schema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: z.literal("owner"),
  csrfToken: z.string().min(32),
});

export type AuthMeV1 = z.infer<typeof AuthMeV1Schema>;

export const ApplicationPatchV1Schema = z.object({
  fields: z
    .array(
      z.object({
        field: z.enum([
          "currentState",
          "actionRequired",
          "companyId",
          "roleId",
          "source",
          "appliedAt",
        ]),
        userValue: z.unknown(),
        locked: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(20),
  expectedVersion: z.string().datetime().optional(),
});

export const ReviewResolutionV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ambiguous_match"),
    action: z.enum(["attach", "new_application", "dismiss"]),
    applicationId: z.string().uuid().optional(),
  }),
  z.object({
    kind: z.literal("entity_merge_suggestion"),
    action: z.enum(["merge", "dismiss"]),
    survivorCompanyId: z.string().uuid().optional(),
    sourceCompanyId: z.string().uuid().optional(),
  }),
  z.object({
    kind: z.literal("state_conflict"),
    action: z.enum(["accept_state", "dismiss"]),
    state: z.string().optional(),
    locked: z.boolean().optional(),
  }),
  z.object({
    kind: z.enum(["uncertain_classification", "unmatched_email", "ghost_confirm"]),
    action: z.enum(["dismiss", "confirm"]),
  }),
]);

export type ApplicationPatchV1 = z.infer<typeof ApplicationPatchV1Schema>;
export type ReviewResolutionV1 = z.infer<typeof ReviewResolutionV1Schema>;

/** FR-2 extraction schema. Breaking changes → ExtractionV2. AGENTS.md §13.3 */
export const ExtractionV1Schema = z.object({
  company: z.string().nullable().optional(),
  roleTitle: z.string().nullable().optional(),
  applicationType: z
    .enum(["internship", "new_grad", "contract", "full_time"])
    .nullable()
    .optional(),
  location: z.string().nullable().optional(),
  workArrangement: z.enum(["remote", "hybrid", "onsite"]).nullable().optional(),
  applicationDate: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  recruiterName: z.string().nullable().optional(),
  recruiterEmail: z.string().nullable().optional(),
  assessmentProvider: z.string().nullable().optional(),
  assessmentDeadline: z.string().nullable().optional(),
  interviewDatetime: z.string().nullable().optional(),
  interviewFormat: z.string().nullable().optional(),
  jobPostingUrl: z.string().nullable().optional(),
  portalUrl: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  actionRequired: z.boolean().optional(),
  atsPlatform: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type ExtractionV1 = z.infer<typeof ExtractionV1Schema>;

export const EvidenceItemSchema = z.object({
  kind: z.enum([
    "ats_template",
    "sender_domain",
    "keyword_rule",
    "llm",
    "calendar",
    "thread_context",
  ]),
  detail: z.string(),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const ClassificationResultV1Schema = z.object({
  eventType: z.enum(eventTypeValues),
  isJobRelated: z.boolean(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceItemSchema),
  extraction: ExtractionV1Schema,
  needsReview: z.boolean(),
  layerTrace: z.array(z.record(z.unknown())).optional(),
});

export type ClassificationResultV1 = z.infer<typeof ClassificationResultV1Schema>;

/**
 * Structured LLM extraction allowlist. AGENTS.md §13.5 / INV-5
 * Only these fields may be written from model output; everything else discarded.
 */
export const LlmExtractionV1Schema = z.object({
  eventType: z.enum(eventTypeValues).optional(),
  isJobRelated: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  /** Concise user-readable justification; never chain-of-thought. INV-5 */
  justification: z.string().max(200),
  company: z.string().max(200).nullable().optional(),
  roleTitle: z.string().max(300).nullable().optional(),
  applicationType: z
    .enum(["internship", "new_grad", "contract", "full_time"])
    .nullable()
    .optional(),
  location: z.string().max(200).nullable().optional(),
  workArrangement: z.enum(["remote", "hybrid", "onsite"]).nullable().optional(),
  assessmentProvider: z.string().max(100).nullable().optional(),
  assessmentDeadline: z.string().max(64).nullable().optional(),
  interviewDatetime: z.string().max(64).nullable().optional(),
  interviewFormat: z.string().max(100).nullable().optional(),
  recruiterName: z.string().max(200).nullable().optional(),
  recruiterEmail: z.string().max(320).nullable().optional(),
  portalUrl: z.string().max(2000).nullable().optional(),
  jobPostingUrl: z.string().max(2000).nullable().optional(),
  actionRequired: z.boolean().optional(),
});

export type LlmExtractionV1 = z.infer<typeof LlmExtractionV1Schema>;

export const ClassifierSettingsV1Schema = z.object({
  mode: z.enum(["deterministic", "local", "api", "hybrid"]).default("deterministic"),
  provider: z.enum(["anthropic", "openai", "ollama"]).nullable().optional(),
  modelId: z.string().max(120).nullable().optional(),
});

export type ClassifierSettingsV1 = z.infer<typeof ClassifierSettingsV1Schema>;

/** Per-signal contribution for match explainability. AGENTS.md §15.1 */
export const MatchSignalSchema = z.object({
  name: z.string(),
  weight: z.number(),
  fired: z.boolean(),
  contribution: z.number(),
  detail: z.string().optional(),
});

export type MatchSignal = z.infer<typeof MatchSignalSchema>;

export const MatchCandidateScoreSchema = z.object({
  applicationId: z.string(),
  score: z.number().min(0).max(1),
  signals: z.array(MatchSignalSchema),
});

export type MatchCandidateScore = z.infer<typeof MatchCandidateScoreSchema>;

/**
 * Pure matcher output (before persistence). AGENTS.md §15.2
 * Breaking changes → MatchResultV2.
 */
export const MatchResultV1Schema = z.object({
  matcherVersion: z.string(),
  decision: z.enum(["auto_attached", "review", "rejected", "new_application"]),
  selectedApplicationId: z.string().nullable(),
  score: z.number().min(0).max(1),
  margin: z.number().min(0).max(1),
  candidates: z.array(MatchCandidateScoreSchema),
  reason: z.string(),
});

export type MatchResultV1 = z.infer<typeof MatchResultV1Schema>;

/** Ordered event fed to the application state reducer. AGENTS.md §16 */
export const ReducerEventV1Schema = z.object({
  id: z.string(),
  eventType: z.string(),
  occurredAt: z.coerce.date(),
  ingestedAt: z.coerce.date(),
  source: z.enum(["email", "user", "system"]),
  messageId: z.string().nullable().optional(),
  classificationResultId: z.string().nullable().optional(),
  payload: z.record(z.unknown()).optional(),
  supersededBy: z.string().nullable().optional(),
});

export type ReducerEventV1 = z.infer<typeof ReducerEventV1Schema>;

export const StateTimelineEntryV1Schema = z.object({
  state: z.string(),
  at: z.coerce.date(),
  eventId: z.string(),
  eventType: z.string(),
});

export type StateTimelineEntryV1 = z.infer<typeof StateTimelineEntryV1Schema>;

export const ReduceResultV1Schema = z.object({
  state: z.string(),
  stateTimeline: z.array(StateTimelineEntryV1Schema),
  actionRequired: z.boolean(),
  flags: z.object({
    conflict: z.boolean(),
    reopened: z.boolean(),
    onHold: z.boolean(),
  }),
  ghostInputs: z.object({
    lastMeaningfulAt: z.coerce.date().nullable(),
    hasFutureScheduled: z.boolean(),
    terminal: z.boolean(),
  }),
  reducerVersion: z.string(),
});

export type ReduceResultV1 = z.infer<typeof ReduceResultV1Schema>;

/** Day thresholds for ghost inference. AGENTS.md §17 */
export const GhostDayThresholdsSchema = z.object({
  staleAfterDays: z.number().int().positive(),
  ghostAfterDays: z.number().int().positive(),
});

export type GhostDayThresholds = z.infer<typeof GhostDayThresholdsSchema>;

export const GhostThresholdsV1Schema = z.object({
  staleAfterDays: z.number().int().positive().default(45),
  ghostAfterDays: z.number().int().positive().default(90),
  /** Per current_state overrides, e.g. final_round: { staleAfterDays: 21, ghostAfterDays: 45 } */
  perStage: z.record(GhostDayThresholdsSchema).default({}),
  /** Per application type: internship | new_grad | full_time | contract */
  perType: z.record(GhostDayThresholdsSchema).default({}),
  /** Per company_id overrides */
  perCompany: z.record(GhostDayThresholdsSchema).default({}),
});

export type GhostThresholdsV1 = z.infer<typeof GhostThresholdsV1Schema>;

export const GhostEvaluateActionSchema = z.enum([
  "none",
  "mark_stale",
  "mark_ghosted",
  "clear",
  "keep_dismissed",
]);

export type GhostEvaluateAction = z.infer<typeof GhostEvaluateActionSchema>;

export const GhostEvaluateResultV1Schema = z.object({
  nextStatus: z.enum(["none", "stale", "possibly_ghosted", "dismissed"]),
  action: GhostEvaluateActionSchema,
  daysInactive: z.number().nullable(),
  paused: z.boolean(),
  evidence: z.string(),
  algorithmVersion: z.string(),
});

export type GhostEvaluateResultV1 = z.infer<typeof GhostEvaluateResultV1Schema>;

/** Allowlisted props keys on analytics events. AGENTS.md §20.4 */
export const ANALYTICS_PROP_KEYS = [
  "title",
  "project",
  "label",
  "href",
  "src",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const analyticsEventTypeValues = [
  "page_view",
  "project_view",
  "resume_view",
  "resume_download",
  "github_click",
  "contact_click",
  "session_start",
  "session_end",
  "custom",
] as const;

export const AnalyticsEventV1Schema = z.object({
  eventId: z.string().uuid(),
  eventType: z.enum(analyticsEventTypeValues),
  path: z.string().max(2000).optional(),
  occurredAt: z.coerce.date(),
  props: z
    .record(z.unknown())
    .optional()
    .refine(
      (props) => {
        if (!props) return true;
        return Object.keys(props).every((k) =>
          (ANALYTICS_PROP_KEYS as readonly string[]).includes(k),
        );
      },
      { message: "props contains non-allowlisted key" },
    ),
  srcToken: z.string().max(64).optional(),
});

export type AnalyticsEventV1 = z.infer<typeof AnalyticsEventV1Schema>;

/** Public ingestion batch. ≤25 events. AGENTS.md §20.4 */
export const AnalyticsIngestBatchV1Schema = z.object({
  siteKey: z.string().min(8).max(128),
  events: z.array(AnalyticsEventV1Schema).min(1).max(25),
});

export type AnalyticsIngestBatchV1 = z.infer<typeof AnalyticsIngestBatchV1Schema>;

export const AnalyticsSiteCreateV1Schema = z.object({
  originAllowlist: z.array(z.string().max(500)).max(50).default([]),
  mode: z.enum(["full", "no_geo", "off"]).default("full"),
});

export type AnalyticsSiteCreateV1 = z.infer<typeof AnalyticsSiteCreateV1Schema>;

export const AnalyticsSiteUpdateV1Schema = z.object({
  originAllowlist: z.array(z.string().max(500)).max(50).optional(),
  mode: z.enum(["full", "no_geo", "off"]).optional(),
});

export type AnalyticsSiteUpdateV1 = z.infer<typeof AnalyticsSiteUpdateV1Schema>;

/** Fired correlation feature row. AGENTS.md §21.1 */
export const CorrelationFeatureV1Schema = z.object({
  featureName: z.string().min(1).max(80),
  featureValue: z.record(z.unknown()).default({}),
  weight: z.number(),
  contribution: z.number(),
});

export type CorrelationFeatureV1 = z.infer<typeof CorrelationFeatureV1Schema>;

export const CorrelationConfidenceBandSchema = z.enum(["none", "low", "medium", "high"]);

export type CorrelationConfidenceBand = z.infer<typeof CorrelationConfidenceBandSchema>;

/** Pure scorer output before persistence. AGENTS.md §21 */
export const CorrelationResultV1Schema = z.object({
  applicationId: z.string().uuid(),
  sessionId: z.string().uuid(),
  score: z.number().min(0).max(1),
  confidenceBand: CorrelationConfidenceBandSchema,
  deterministic: z.boolean(),
  algorithmVersion: z.string(),
  explanation: z.string().min(1).max(2000),
  features: z.array(CorrelationFeatureV1Schema),
});

export type CorrelationResultV1 = z.infer<typeof CorrelationResultV1Schema>;

export const CorrelationFeedbackV1Schema = z.object({
  feedback: z.enum(["confirmed", "rejected"]),
});

export type CorrelationFeedbackV1 = z.infer<typeof CorrelationFeedbackV1Schema>;

export const MintLinkV1Schema = z.object({
  applicationId: z.string().uuid(),
  /** When true, also expose the tracked resume URL for this token. */
  enableResumeLink: z.boolean().default(true),
});

export type MintLinkV1 = z.infer<typeof MintLinkV1Schema>;
