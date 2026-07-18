import { z } from "zod";
import { EventType } from "./enums.js";

const eventTypeValues = Object.values(EventType) as [string, ...string[]];

/** FR-2 extraction schema. Breaking changes → ExtractionV2. AGENTS.md §13.3 */
export const ExtractionV1Schema = z.object({
  company: z.string().nullable().optional(),
  roleTitle: z.string().nullable().optional(),
  applicationType: z
    .enum(["internship", "new_grad", "contract", "full_time"])
    .nullable()
    .optional(),
  location: z.string().nullable().optional(),
  workArrangement: z
    .enum(["remote", "hybrid", "onsite"])
    .nullable()
    .optional(),
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

export type ClassificationResultV1 = z.infer<
  typeof ClassificationResultV1Schema
>;

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
  decision: z.enum([
    "auto_attached",
    "review",
    "rejected",
    "new_application",
  ]),
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
