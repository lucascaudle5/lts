ALTER TYPE "public"."entity_type" ADD VALUE 'life_record';--> statement-breakpoint
CREATE TABLE "life_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "life_records_type_matches" CHECK ("life_records"."data"->>'type' = "life_records"."type")
);
--> statement-breakpoint
ALTER TABLE "life_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "ai_authority" text DEFAULT 'ask' NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "details" jsonb DEFAULT '{"estimateMinutes":0,"nextAction":"","blocker":"","projectId":null,"subtasks":[],"sessions":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "life_records" ADD CONSTRAINT "life_records_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "life_records_user_type_idx" ON "life_records" USING btree ("user_id","type");