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
import { idColumn, mutableTimestamps, timestamps, users } from "./identity-email.js";
import { applications } from "./domain.js";

// ── §10.6 Analytics & correlation ────────────────────────────────────────
// INV-8: no IP column on sessions or events.

export const analyticsSites = pgTable(
  "analytics_sites",
  {
    id: idColumn,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteKey: text("site_key").notNull(),
    originAllowlist: text("origin_allowlist").array().notNull().default([]),
    mode: text("mode").notNull().default("full"),
    ...mutableTimestamps,
  },
  (t) => [uniqueIndex("analytics_sites_key_uidx").on(t.siteKey)],
);

export const analyticsSessions = pgTable("analytics_sessions", {
  id: idColumn,
  siteId: uuid("site_id")
    .notNull()
    .references(() => analyticsSites.id, { onDelete: "cascade" }),
  visitorHash: text("visitor_hash").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  entryPath: text("entry_path"),
  referrerHost: text("referrer_host"),
  utm: jsonb("utm"),
  deviceCategory: text("device_category"),
  browserFamily: text("browser_family"),
  geoCountry: text("geo_country"),
  geoRegion: text("geo_region"),
  geoCity: text("geo_city"),
  ...timestamps,
});

/**
 * Raw ingest rows carry visitor/context for deferred sessionization.
 * session_id is null until analytics.aggregate links them. AGENTS.md §20.4
 * INV-8: never add an IP column.
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: idColumn,
    eventId: uuid("event_id").notNull(),
    siteId: uuid("site_id").references(() => analyticsSites.id, {
      onDelete: "cascade",
    }),
    sessionId: uuid("session_id").references(() => analyticsSessions.id),
    visitorHash: text("visitor_hash"),
    eventType: text("event_type").notNull(),
    path: text("path"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    props: jsonb("props").default({}),
    srcToken: text("src_token"),
    referrerHost: text("referrer_host"),
    deviceCategory: text("device_category"),
    browserFamily: text("browser_family"),
    geoCountry: text("geo_country"),
    geoRegion: text("geo_region"),
    geoCity: text("geo_city"),
    sessionizedAt: timestamp("sessionized_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("analytics_events_event_id_uidx").on(t.eventId),
    index("analytics_events_session_idx").on(t.sessionId),
    index("analytics_events_src_token_idx").on(t.srcToken),
    index("analytics_events_occurred_idx").on(t.occurredAt),
    index("analytics_events_site_visitor_idx").on(t.siteId, t.visitorHash),
  ],
);

export const correlationPredictions = pgTable(
  "correlation_predictions",
  {
    id: idColumn,
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => analyticsSessions.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    confidenceBand: text("confidence_band").notNull(),
    deterministic: boolean("deterministic").notNull().default(false),
    algorithmVersion: text("algorithm_version").notNull(),
    explanation: text("explanation").notNull(),
    userFeedback: text("user_feedback"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("correlation_predictions_uidx").on(
      t.applicationId,
      t.sessionId,
      t.algorithmVersion,
    ),
  ],
);

export const correlationFeatures = pgTable("correlation_features", {
  id: idColumn,
  predictionId: uuid("prediction_id")
    .notNull()
    .references(() => correlationPredictions.id, { onDelete: "cascade" }),
  featureName: text("feature_name").notNull(),
  featureValue: jsonb("feature_value"),
  weight: real("weight"),
  contribution: real("contribution"),
  ...timestamps,
});
