CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TYPE "public"."command_kind" ADD VALUE 'task.update' BEFORE 'observation.record';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "priority" "task_priority" DEFAULT 'medium' NOT NULL;