ALTER TABLE "companies" ADD COLUMN "board" jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "last_full_crawl_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "desc_checked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Jobs from these ATSs always came with their full description.
UPDATE "jobs" SET "desc_checked" = true WHERE "ats" IN ('greenhouse', 'lever', 'ashby');
