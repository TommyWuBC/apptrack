CREATE TABLE "classification_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"message_id" uuid NOT NULL,
	"classifier_version_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"event_type" text NOT NULL,
	"is_job_related" boolean NOT NULL,
	"confidence" real NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extraction" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"layer_trace" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classifier_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_string" text NOT NULL,
	"rules_version" text NOT NULL,
	"prompt_version" text,
	"model_id" text,
	"extraction_schema_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_email_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text DEFAULT 'gmail' NOT NULL,
	"provider_account_email" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_cursor" text,
	"backfill_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"message_id" uuid NOT NULL,
	"filename" text,
	"mime_type" text,
	"size_bytes" integer,
	"sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"thread_id" uuid,
	"provider_message_id" text NOT NULL,
	"internal_date" timestamp with time zone NOT NULL,
	"from_address" text,
	"from_name" text,
	"to_addresses" text[],
	"subject" text,
	"snippet" text,
	"headers_subset" jsonb,
	"has_raw" boolean DEFAULT false NOT NULL,
	"raw_encrypted" "bytea",
	"deleted_at_provider" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"provider_thread_id" text NOT NULL,
	"subject_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_entities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"classification_result_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"value_text" text,
	"value_norm" text,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalized_emails" (
	"id" uuid PRIMARY KEY NOT NULL,
	"message_id" uuid NOT NULL,
	"text_plain" text,
	"text_full" text,
	"sanitized_html" text,
	"detected_language" text,
	"links" jsonb,
	"calendar_event" jsonb,
	"normalizer_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_credentials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"encrypted_refresh_token" "bytea" NOT NULL,
	"encrypted_access_token" "bytea",
	"access_token_expires_at" timestamp with time zone,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"key_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"ip_country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"application_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"message_id" uuid,
	"classification_result_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"superseded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_match_candidates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"message_id" uuid NOT NULL,
	"application_id" uuid,
	"score" real NOT NULL,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decision" text NOT NULL,
	"matcher_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"role_id" uuid,
	"current_state" text DEFAULT 'unknown' NOT NULL,
	"applied_at" timestamp with time zone,
	"source" text,
	"last_event_at" timestamp with time zone,
	"ghost_status" text DEFAULT 'none' NOT NULL,
	"action_required" boolean DEFAULT false NOT NULL,
	"state_version" text,
	"unique_link_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"canonical_name" text NOT NULL,
	"primary_domain" text,
	"hq_location" jsonb,
	"office_locations" jsonb DEFAULT '[]'::jsonb,
	"is_staffing_agency" boolean DEFAULT false NOT NULL,
	"parent_company_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_aliases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"alias_type" text NOT NULL,
	"source" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_queue_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"title_raw" text NOT NULL,
	"title_norm" text,
	"level" text,
	"requisition_id" text,
	"posting_url" text,
	"location" jsonb,
	"work_arrangement" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_corrections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"field" text NOT NULL,
	"machine_value" jsonb,
	"user_value" jsonb,
	"locked" boolean DEFAULT false NOT NULL,
	"reverted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"session_id" uuid,
	"event_type" text NOT NULL,
	"path" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb,
	"src_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"visitor_hash" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"entry_path" text,
	"referrer_host" text,
	"utm" jsonb,
	"device_category" text,
	"browser_family" text,
	"geo_country" text,
	"geo_region" text,
	"geo_city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_sites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"site_key" text NOT NULL,
	"origin_allowlist" text[] DEFAULT '{}' NOT NULL,
	"mode" text DEFAULT 'full' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correlation_features" (
	"id" uuid PRIMARY KEY NOT NULL,
	"prediction_id" uuid NOT NULL,
	"feature_name" text NOT NULL,
	"feature_value" jsonb,
	"weight" real,
	"contribution" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correlation_predictions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"application_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"score" real NOT NULL,
	"confidence_band" text NOT NULL,
	"deterministic" boolean DEFAULT false NOT NULL,
	"algorithm_version" text NOT NULL,
	"explanation" text NOT NULL,
	"user_feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classification_results" ADD CONSTRAINT "classification_results_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_results" ADD CONSTRAINT "classification_results_classifier_version_id_classifier_versions_id_fk" FOREIGN KEY ("classifier_version_id") REFERENCES "public"."classifier_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_email_accounts" ADD CONSTRAINT "connected_email_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_account_id_connected_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."connected_email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_account_id_connected_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."connected_email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_entities" ADD CONSTRAINT "extracted_entities_classification_result_id_classification_results_id_fk" FOREIGN KEY ("classification_result_id") REFERENCES "public"."classification_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_emails" ADD CONSTRAINT "normalized_emails_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_credentials" ADD CONSTRAINT "oauth_credentials_account_id_connected_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."connected_email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_classification_result_id_classification_results_id_fk" FOREIGN KEY ("classification_result_id") REFERENCES "public"."classification_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_match_candidates" ADD CONSTRAINT "application_match_candidates_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_match_candidates" ADD CONSTRAINT "application_match_candidates_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_aliases" ADD CONSTRAINT "company_aliases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_session_id_analytics_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."analytics_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD CONSTRAINT "analytics_sessions_site_id_analytics_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."analytics_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_sites" ADD CONSTRAINT "analytics_sites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correlation_features" ADD CONSTRAINT "correlation_features_prediction_id_correlation_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."correlation_predictions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correlation_predictions" ADD CONSTRAINT "correlation_predictions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correlation_predictions" ADD CONSTRAINT "correlation_predictions_session_id_analytics_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."analytics_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "classification_results_uidx" ON "classification_results" USING btree ("message_id","classifier_version_id");--> statement-breakpoint
CREATE INDEX "classification_results_review_idx" ON "classification_results" USING btree ("needs_review") WHERE "classification_results"."needs_review" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "classifier_versions_uidx" ON "classifier_versions" USING btree ("version_string");--> statement-breakpoint
CREATE UNIQUE INDEX "connected_email_accounts_uidx" ON "connected_email_accounts" USING btree ("user_id","provider","provider_account_email");--> statement-breakpoint
CREATE UNIQUE INDEX "email_messages_uidx" ON "email_messages" USING btree ("account_id","provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_threads_uidx" ON "email_threads" USING btree ("account_id","provider_thread_id");--> statement-breakpoint
CREATE INDEX "extracted_entities_type_norm_idx" ON "extracted_entities" USING btree ("entity_type","value_norm");--> statement-breakpoint
CREATE UNIQUE INDEX "normalized_emails_msg_ver_uidx" ON "normalized_emails" USING btree ("message_id","normalizer_version");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_credentials_account_uidx" ON "oauth_credentials" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "application_events_app_occurred_idx" ON "application_events" USING btree ("application_id","occurred_at");--> statement-breakpoint
CREATE INDEX "applications_user_state_idx" ON "applications" USING btree ("user_id","current_state");--> statement-breakpoint
CREATE INDEX "applications_last_event_idx" ON "applications" USING btree ("last_event_at");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_link_token_uidx" ON "applications" USING btree ("unique_link_token") WHERE "applications"."unique_link_token" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_canonical_uidx" ON "companies" USING btree ("canonical_name");--> statement-breakpoint
CREATE UNIQUE INDEX "company_aliases_uidx" ON "company_aliases" USING btree ("alias","alias_type");--> statement-breakpoint
CREATE INDEX "review_queue_open_idx" ON "review_queue_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "roles_company_idx" ON "roles" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_events_event_id_uidx" ON "analytics_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "analytics_events_session_idx" ON "analytics_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "analytics_events_src_token_idx" ON "analytics_events" USING btree ("src_token");--> statement-breakpoint
CREATE INDEX "analytics_events_occurred_idx" ON "analytics_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_sites_key_uidx" ON "analytics_sites" USING btree ("site_key");--> statement-breakpoint
CREATE UNIQUE INDEX "correlation_predictions_uidx" ON "correlation_predictions" USING btree ("application_id","session_id","algorithm_version");