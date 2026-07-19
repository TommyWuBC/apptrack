import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  classificationResults,
  emailMessages,
  idColumn,
  mutableTimestamps,
  timestamps,
  users,
} from "./identity-email.js";

// ── §10.4 Domain entities ────────────────────────────────────────────────

export const companies = pgTable(
  "companies",
  {
    id: idColumn,
    canonicalName: text("canonical_name").notNull(),
    primaryDomain: text("primary_domain"),
    hqLocation: jsonb("hq_location"),
    officeLocations: jsonb("office_locations").$type<unknown[]>().default([]),
    isStaffingAgency: boolean("is_staffing_agency").notNull().default(false),
    parentCompanyId: uuid("parent_company_id"),
    ...mutableTimestamps,
  },
  (t) => [uniqueIndex("companies_canonical_uidx").on(t.canonicalName)],
);

export const companyAliases = pgTable(
  "company_aliases",
  {
    id: idColumn,
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    aliasType: text("alias_type").notNull(),
    source: text("source").notNull().default("auto"),
    ...timestamps,
  },
  (t) => [uniqueIndex("company_aliases_uidx").on(t.alias, t.aliasType)],
);

export const roles = pgTable(
  "roles",
  {
    id: idColumn,
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    titleRaw: text("title_raw").notNull(),
    titleNorm: text("title_norm"),
    level: text("level"),
    requisitionId: text("requisition_id"),
    postingUrl: text("posting_url"),
    location: jsonb("location"),
    workArrangement: text("work_arrangement"),
    ...mutableTimestamps,
  },
  (t) => [index("roles_company_idx").on(t.companyId)],
);

/**
 * Unique link tokens are optional; only enforce uniqueness when present.
 * Partial unique index avoids colliding NULLs across applications.
 */
export const applications = pgTable(
  "applications",
  {
    id: idColumn,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    roleId: uuid("role_id").references(() => roles.id),
    currentState: text("current_state").notNull().default("unknown"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    source: text("source"),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    ghostStatus: text("ghost_status").notNull().default("none"),
    actionRequired: boolean("action_required").notNull().default(false),
    stateVersion: text("state_version"),
    uniqueLinkToken: text("unique_link_token"),
    ...mutableTimestamps,
  },
  (t) => [
    index("applications_user_state_idx").on(t.userId, t.currentState),
    index("applications_last_event_idx").on(t.lastEventAt),
    uniqueIndex("applications_link_token_uidx")
      .on(t.uniqueLinkToken)
      .where(sql`${t.uniqueLinkToken} is not null`),
  ],
);

/** INV-9: append-only source of truth. Never UPDATE/DELETE in app code. */
export const applicationEvents = pgTable(
  "application_events",
  {
    id: idColumn,
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    source: text("source").notNull(),
    messageId: uuid("message_id").references(() => emailMessages.id),
    classificationResultId: uuid("classification_result_id").references(
      () => classificationResults.id,
    ),
    payload: jsonb("payload").default({}),
    supersededBy: uuid("superseded_by"),
    ...timestamps,
  },
  (t) => [
    index("application_events_app_occurred_idx").on(
      t.applicationId,
      t.occurredAt,
    ),
  ],
);

export const applicationMatchCandidates = pgTable(
  "application_match_candidates",
  {
    id: idColumn,
    messageId: uuid("message_id")
      .notNull()
      .references(() => emailMessages.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id),
    score: real("score").notNull(),
    signals: jsonb("signals").notNull().default({}),
    decision: text("decision").notNull(),
    matcherVersion: text("matcher_version").notNull(),
    ...timestamps,
  },
);

// ── §10.5 Human-in-the-loop ──────────────────────────────────────────────

export const userCorrections = pgTable("user_corrections", {
  id: idColumn,
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  field: text("field").notNull(),
  machineValue: jsonb("machine_value"),
  userValue: jsonb("user_value"),
  locked: boolean("locked").notNull().default(false),
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
  ...timestamps,
});

export const reviewQueueItems = pgTable(
  "review_queue_items",
  {
    id: idColumn,
    kind: text("kind").notNull(),
    refId: uuid("ref_id").notNull(),
    status: text("status").notNull().default("open"),
    resolution: jsonb("resolution"),
    ...mutableTimestamps,
  },
  (t) => [index("review_queue_open_idx").on(t.status)],
);

export const notifications = pgTable("notifications", {
  id: idColumn,
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  ...timestamps,
});

export const auditLog = pgTable("audit_log", {
  id: idColumn,
  userId: uuid("user_id").references(() => users.id),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  metadata: jsonb("metadata").default({}),
  ...timestamps,
});

/**
 * Per-user settings (ghost thresholds, etc.). AGENTS.md §17
 * One row per user; ghost_thresholds jsonb holds GhostThresholdsV1.
 */
export const userSettings = pgTable(
  "user_settings",
  {
    id: idColumn,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ghostThresholds: jsonb("ghost_thresholds").notNull().default({}),
    ...mutableTimestamps,
  },
  (t) => [uniqueIndex("user_settings_user_uidx").on(t.userId)],
);
