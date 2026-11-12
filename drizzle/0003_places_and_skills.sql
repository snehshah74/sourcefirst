ALTER TABLE "jobs" ADD COLUMN "places" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "skills" text[];--> statement-breakpoint
CREATE INDEX "jobs_places" ON "jobs" USING gin ("places");--> statement-breakpoint
CREATE INDEX "jobs_skills" ON "jobs" USING gin ("skills");