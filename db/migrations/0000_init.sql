CREATE TYPE "public"."actor" AS ENUM('user', 'automation');--> statement-breakpoint
CREATE TYPE "public"."block_kind" AS ENUM('work', 'class', 'exam', 'fitness', 'meal', 'focus', 'personal');--> statement-breakpoint
CREATE TYPE "public"."change_action" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."change_origin" AS ENUM('manual', 'proposal', 'undo');--> statement-breakpoint
CREATE TYPE "public"."command_kind" AS ENUM('schedule_block.create', 'task.create', 'observation.record');--> statement-breakpoint
CREATE TYPE "public"."confidence" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('schedule_block', 'task', 'observation', 'profile');--> statement-breakpoint
CREATE TYPE "public"."harness_run_status" AS ENUM('succeeded', 'invalid_output', 'provider_error', 'fell_back');--> statement-breakpoint
CREATE TYPE "public"."observation_category" AS ENUM('energy', 'sleep', 'stress', 'capacity', 'note');--> statement-breakpoint
CREATE TYPE "public"."observation_source" AS ENUM('user_statement', 'manual_entry');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('needs_input', 'ready', 'approved', 'rejected', 'applied', 'failed');--> statement-breakpoint
CREATE TYPE "public"."provenance_source" AS ENUM('model', 'parser', 'user');--> statement-breakpoint
CREATE TYPE "public"."sensitivity" AS ENUM('normal', 'health');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('errand', 'assignment', 'exam', 'chore', 'other');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'done', 'parked');--> statement-breakpoint
CREATE TABLE "captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"reference_date" date NOT NULL,
	"timezone" text NOT NULL,
	"safety_stop" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "captures_text_length" CHECK (char_length("captures"."text") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "captures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mutation_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "change_action" NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"actor" "actor" NOT NULL,
	"origin" "change_origin" NOT NULL,
	"proposal_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "harness_run_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"harness_run_id" uuid NOT NULL,
	"raw_prompt" text NOT NULL,
	"raw_output" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "harness_run_payloads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "harness_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"capture_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"prompt_version" text NOT NULL,
	"prompt_sha256" text NOT NULL,
	"output_sha256" text,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposal_item_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"validation_error_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "harness_run_status" NOT NULL,
	"latency_ms" integer,
	"tokens_in" integer,
	"tokens_out" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "harness_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "observation_category" NOT NULL,
	"value_text" text NOT NULL,
	"value_num" double precision,
	"occurred_on" date NOT NULL,
	"source" "observation_source" NOT NULL,
	"quote" text NOT NULL,
	"sensitivity" "sensitivity" DEFAULT 'health' NOT NULL,
	"origin" "change_origin" NOT NULL,
	"origin_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"timezone" text NOT NULL,
	"ai_sensitive_categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "proposal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"capture_id" uuid NOT NULL,
	"harness_run_id" uuid,
	"kind" "command_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"original_payload" jsonb NOT NULL,
	"status" "proposal_status" NOT NULL,
	"missing_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "provenance_source" NOT NULL,
	"model" text,
	"prompt_version" text,
	"confidence" "confidence" NOT NULL,
	"quote" text NOT NULL,
	"decided_at" timestamp with time zone,
	"applied_entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "schedule_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "block_kind" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"fixed" boolean DEFAULT false NOT NULL,
	"origin" "change_origin" NOT NULL,
	"origin_item_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_blocks_ends_after_starts" CHECK ("schedule_blocks"."ends_at" > "schedule_blocks"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "schedule_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "task_kind" NOT NULL,
	"due_on" date,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"origin" "change_origin" NOT NULL,
	"origin_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "captures" ADD CONSTRAINT "captures_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_proposal_item_id_proposal_items_id_fk" FOREIGN KEY ("proposal_item_id") REFERENCES "public"."proposal_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_run_payloads" ADD CONSTRAINT "harness_run_payloads_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_run_payloads" ADD CONSTRAINT "harness_run_payloads_harness_run_id_harness_runs_id_fk" FOREIGN KEY ("harness_run_id") REFERENCES "public"."harness_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_runs" ADD CONSTRAINT "harness_runs_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harness_runs" ADD CONSTRAINT "harness_runs_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_origin_item_id_proposal_items_id_fk" FOREIGN KEY ("origin_item_id") REFERENCES "public"."proposal_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_harness_run_id_harness_runs_id_fk" FOREIGN KEY ("harness_run_id") REFERENCES "public"."harness_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_origin_item_id_proposal_items_id_fk" FOREIGN KEY ("origin_item_id") REFERENCES "public"."proposal_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_origin_item_id_proposal_items_id_fk" FOREIGN KEY ("origin_item_id") REFERENCES "public"."proposal_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "captures_user_created_idx" ON "captures" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "change_log_user_created_idx" ON "change_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "change_log_mutation_idx" ON "change_log" USING btree ("mutation_id");--> statement-breakpoint
CREATE INDEX "change_log_entity_idx" ON "change_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "harness_run_payloads_expires_idx" ON "harness_run_payloads" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "harness_runs_capture_idx" ON "harness_runs" USING btree ("capture_id");--> statement-breakpoint
CREATE INDEX "observations_user_occurred_idx" ON "observations" USING btree ("user_id","occurred_on");--> statement-breakpoint
CREATE INDEX "proposal_items_capture_idx" ON "proposal_items" USING btree ("capture_id");--> statement-breakpoint
CREATE INDEX "proposal_items_user_status_idx" ON "proposal_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "schedule_blocks_user_starts_idx" ON "schedule_blocks" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "tasks_user_status_idx" ON "tasks" USING btree ("user_id","status");