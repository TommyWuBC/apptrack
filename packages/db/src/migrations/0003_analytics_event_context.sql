ALTER TABLE "analytics_events" ADD COLUMN "site_id" uuid;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "visitor_hash" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "referrer_host" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "device_category" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "browser_family" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "geo_country" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "geo_region" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "geo_city" text;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "sessionized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_site_id_analytics_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."analytics_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_site_visitor_idx" ON "analytics_events" USING btree ("site_id","visitor_hash");
