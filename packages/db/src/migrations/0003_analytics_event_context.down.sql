DROP INDEX "analytics_events_site_visitor_idx";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP CONSTRAINT "analytics_events_site_id_analytics_sites_id_fk";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "sessionized_at";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "geo_city";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "geo_region";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "geo_country";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "browser_family";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "device_category";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "referrer_host";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "visitor_hash";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "site_id";
