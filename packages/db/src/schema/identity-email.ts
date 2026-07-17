import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** bytea column helper */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const mutableTimestamps = {
  ...timestamps,
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** UUIDv7 default — generated in app layer; DB accepts any uuid. */
export const idColumn = uuid("id").primaryKey().notNull();

// ── §10.1 Identity & connection ──────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: idColumn,
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("owner"),
    ...mutableTimestamps,
  },
  (t) => [uniqueIndex("users_email_uidx").on(t.email)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // SHA-256 of token, not the token
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
  ipCountry: text("ip_country"),
  ...timestamps,
});

export const connectedEmailAccounts = pgTable(
  "connected_email_accounts",
  {
    id: idColumn,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("gmail"),
    providerAccountEmail: text("provider_account_email").notNull(),
    status: text("status").notNull().default("active"), // active|reauth_required|disconnected
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    syncCursor: text("sync_cursor"), // Gmail historyId
    backfillState: jsonb("backfill_state"),
    ...mutableTimestamps,
  },
  (t) => [
    uniqueIndex("connected_email_accounts_uidx").on(
      t.userId,
      t.provider,
      t.providerAccountEmail,
    ),
  ],
);

/**
 * OAuth credentials — INV-1: only encrypted bytea, never plaintext columns.
 * Dedicated repo must not expose toJSON with secrets.
 */
export const oauthCredentials = pgTable(
  "oauth_credentials",
  {
    id: idColumn,
    accountId: uuid("account_id")
      .notNull()
      .references(() => connectedEmailAccounts.id, { onDelete: "cascade" }),
    encryptedRefreshToken: bytea("encrypted_refresh_token").notNull(),
    encryptedAccessToken: bytea("encrypted_access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    scopes: text("scopes").array().notNull().default(sql`ARRAY[]::text[]`),
    keyId: text("key_id").notNull(),
    ...mutableTimestamps,
  },
  (t) => [uniqueIndex("oauth_credentials_account_uidx").on(t.accountId)],
);

// ── §10.2 Email storage ──────────────────────────────────────────────────

export const emailThreads = pgTable(
  "email_threads",
  {
    id: idColumn,
    accountId: uuid("account_id")
      .notNull()
      .references(() => connectedEmailAccounts.id, { onDelete: "cascade" }),
    providerThreadId: text("provider_thread_id").notNull(),
    subjectHash: text("subject_hash"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("email_threads_uidx").on(t.accountId, t.providerThreadId),
  ],
);

export const emailMessages = pgTable(
  "email_messages",
  {
    id: idColumn,
    accountId: uuid("account_id")
      .notNull()
      .references(() => connectedEmailAccounts.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").references(() => emailThreads.id, {
      onDelete: "set null",
    }),
    providerMessageId: text("provider_message_id").notNull(),
    internalDate: timestamp("internal_date", { withTimezone: true }).notNull(),
    fromAddress: text("from_address"),
    fromName: text("from_name"),
    toAddresses: text("to_addresses").array(),
    subject: text("subject"),
    snippet: text("snippet"),
    headersSubset: jsonb("headers_subset"),
    hasRaw: boolean("has_raw").notNull().default(false),
    rawEncrypted: bytea("raw_encrypted"),
    deletedAtProvider: timestamp("deleted_at_provider", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("email_messages_uidx").on(t.accountId, t.providerMessageId),
  ],
);

export const normalizedEmails = pgTable(
  "normalized_emails",
  {
    id: idColumn,
    messageId: uuid("message_id")
      .notNull()
      .references(() => emailMessages.id, { onDelete: "cascade" }),
    textPlain: text("text_plain"),
    textFull: text("text_full"),
    sanitizedHtml: text("sanitized_html"),
    detectedLanguage: text("detected_language"),
    links: jsonb("links"),
    calendarEvent: jsonb("calendar_event"),
    normalizerVersion: text("normalizer_version").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("normalized_emails_msg_ver_uidx").on(
      t.messageId,
      t.normalizerVersion,
    ),
  ],
);

export const emailAttachments = pgTable("email_attachments", {
  id: idColumn,
  messageId: uuid("message_id")
    .notNull()
    .references(() => emailMessages.id, { onDelete: "cascade" }),
  filename: text("filename"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  sha256: text("sha256"),
  ...timestamps,
});

// ── §10.3 Classification & extraction ────────────────────────────────────

export const classifierVersions = pgTable(
  "classifier_versions",
  {
    id: idColumn,
    versionString: text("version_string").notNull(),
    rulesVersion: text("rules_version").notNull(),
    promptVersion: text("prompt_version"),
    modelId: text("model_id"),
    extractionSchemaVersion: text("extraction_schema_version").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("classifier_versions_uidx").on(t.versionString)],
);

export const classificationResults = pgTable(
  "classification_results",
  {
    id: idColumn,
    messageId: uuid("message_id")
      .notNull()
      .references(() => emailMessages.id, { onDelete: "cascade" }),
    classifierVersionId: uuid("classifier_version_id")
      .notNull()
      .references(() => classifierVersions.id),
    mode: text("mode").notNull(), // deterministic|local|api|hybrid
    eventType: text("event_type").notNull(),
    isJobRelated: boolean("is_job_related").notNull(),
    confidence: real("confidence").notNull(),
    evidence: jsonb("evidence").notNull().default([]),
    extraction: jsonb("extraction").notNull().default({}),
    needsReview: boolean("needs_review").notNull().default(false),
    layerTrace: jsonb("layer_trace"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("classification_results_uidx").on(
      t.messageId,
      t.classifierVersionId,
    ),
    index("classification_results_review_idx")
      .on(t.needsReview)
      .where(sql`${t.needsReview} = true`),
  ],
);

export const extractedEntities = pgTable(
  "extracted_entities",
  {
    id: idColumn,
    classificationResultId: uuid("classification_result_id")
      .notNull()
      .references(() => classificationResults.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    valueText: text("value_text"),
    valueNorm: text("value_norm"),
    confidence: real("confidence"),
    ...timestamps,
  },
  (t) => [index("extracted_entities_type_norm_idx").on(t.entityType, t.valueNorm)],
);
