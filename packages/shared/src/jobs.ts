import { z } from "zod";

export const JobName = {
  EMAIL_SYNC: "email.sync",
  EMAIL_BACKFILL: "email.backfill",
  EMAIL_NORMALIZE: "email.normalize",
  EMAIL_CLASSIFY: "email.classify",
  APPLICATION_MATCH: "application.match",
  APPLICATION_RECOMPUTE: "application.recompute",
  MATCH_REEVALUATE: "match.reevaluate",
  GHOST_EVALUATE: "ghost.evaluate",
  ANALYTICS_AGGREGATE: "analytics.aggregate",
  RETENTION_CLEANUP: "retention.cleanup",
  OAUTH_REFRESH_SWEEP: "oauth.refresh-sweep",
  EMAIL_REPROCESS: "email.reprocess",
  CORRELATION_SCORE: "correlation.score",
} as const;

export type JobName = (typeof JobName)[keyof typeof JobName];

const OptionalUuidSchema = z.string().uuid().optional();

export const EmailSyncJobV1Schema = z.object({
  accountId: OptionalUuidSchema,
});

export const EmailBackfillJobV1Schema = z.object({
  accountId: OptionalUuidSchema,
  afterDate: z.string().date(),
  beforeDate: z.string().date().optional(),
  maxMessages: z.number().int().min(1).max(500).default(500),
});

export const MessageJobV1Schema = z.object({
  messageId: z.string().uuid(),
});

export const ApplicationJobV1Schema = z.object({
  applicationId: z.string().uuid(),
});

export const CompanyJobV1Schema = z.object({
  companyId: z.string().uuid(),
});

export const ScheduledJobV1Schema = z.object({
  scheduledAt: z.string().datetime().optional(),
});

export const EmailReprocessJobV1Schema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("all"),
    targetClassifierVersion: z.string().optional(),
  }),
  z.object({
    scope: z.literal("message_ids"),
    messageIds: z.array(z.string().uuid()).min(1).max(500),
    targetClassifierVersion: z.string().optional(),
  }),
  z.object({
    scope: z.literal("date_range"),
    afterDate: z.string().date(),
    beforeDate: z.string().date().optional(),
    targetClassifierVersion: z.string().optional(),
  }),
]);

export type EmailSyncJobV1 = z.infer<typeof EmailSyncJobV1Schema>;
export type EmailBackfillJobV1 = z.infer<typeof EmailBackfillJobV1Schema>;
export type MessageJobV1 = z.infer<typeof MessageJobV1Schema>;
export type ApplicationJobV1 = z.infer<typeof ApplicationJobV1Schema>;
export type CompanyJobV1 = z.infer<typeof CompanyJobV1Schema>;
export type ScheduledJobV1 = z.infer<typeof ScheduledJobV1Schema>;
export type EmailReprocessJobV1 = z.infer<typeof EmailReprocessJobV1Schema>;

export const CorrelationScoreJobV1Schema = z.object({
  sessionIds: z.array(z.string().uuid()).max(500).optional(),
  applicationId: z.string().uuid().optional(),
  algorithmVersion: z.string().optional(),
});

export type CorrelationScoreJobV1 = z.infer<typeof CorrelationScoreJobV1Schema>;
