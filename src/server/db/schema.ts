import { sql } from "drizzle-orm";
import {
  boolean,
  bigserial,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { CommandKind } from "@/contracts/commands";
import type { TaskDetails } from "@/contracts/commands";
import type { LifeRecord } from "@/contracts/life";
import {
  Actor,
  BlockKind,
  ChangeOrigin,
  Confidence,
  ObservationCategory,
  ObservationSource,
  Sensitivity,
  TaskKind,
  TaskPriority,
  TaskStatus,
  type MissingSlot,
  type Warning,
} from "@/contracts/common";
import { ProposalStatus, ProvenanceSource } from "@/contracts/proposals";

/*
 * Every table: `user_id`, `created_at`, RLS enabled with no policies for anon/authenticated, so the
 * public Supabase key cannot read data. The server's privileged connection bypasses RLS; repository
 * `user_id` filters plus isolation tests are the tenancy control (docs/ARCHITECTURE.md).
 * `user_id` is the Supabase auth user id; there is deliberately no FK into the `auth` schema.
 */

/** zod enums are never empty; pgEnum needs that as a tuple type. */
function values<T extends string>(options: readonly T[]): [T, ...T[]] {
  return options as [T, ...T[]];
}

export const blockKind = pgEnum("block_kind", values(BlockKind.options));
export const taskKind = pgEnum("task_kind", values(TaskKind.options));
export const taskStatus = pgEnum("task_status", values(TaskStatus.options));
export const taskPriority = pgEnum("task_priority", values(TaskPriority.options));
export const observationCategory = pgEnum(
  "observation_category",
  values(ObservationCategory.options),
);
export const observationSource = pgEnum("observation_source", values(ObservationSource.options));
export const sensitivity = pgEnum("sensitivity", values(Sensitivity.options));
export const changeOrigin = pgEnum("change_origin", values(ChangeOrigin.options));
export const actor = pgEnum("actor", values(Actor.options));
export const confidence = pgEnum("confidence", values(Confidence.options));
export const commandKind = pgEnum("command_kind", values(CommandKind.options));
export const proposalStatus = pgEnum("proposal_status", values(ProposalStatus.options));
export const provenanceSource = pgEnum("provenance_source", values(ProvenanceSource.options));
export const harnessRunStatus = pgEnum("harness_run_status", [
  "succeeded",
  "invalid_output",
  "provider_error",
  "fell_back",
]);
export const entityType = pgEnum("entity_type", [
  "schedule_block",
  "task",
  "observation",
  "profile",
  "life_record",
]);
export const changeAction = pgEnum("change_action", ["create", "update", "delete"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const id = () => uuid("id").primaryKey().defaultRandom();
const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => profiles.userId, { onDelete: "cascade" });

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  timezone: text("timezone").notNull(),
  aiAuthority: text("ai_authority").notNull().default("ask"),
  theme: text("theme").notNull().default("sandstone"),
  aiSensitiveCategories: text("ai_sensitive_categories")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS();

export const captures = pgTable(
  "captures",
  {
    id: id(),
    userId: userId(),
    text: text("text").notNull(),
    referenceDate: date("reference_date").notNull(),
    timezone: text("timezone").notNull(),
    safetyStop: boolean("safety_stop").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("captures_user_created_idx").on(t.userId, t.createdAt),
    check("captures_text_length", sql`char_length(${t.text}) between 1 and 2000`),
  ],
).enableRLS();

export const harnessRuns = pgTable(
  "harness_runs",
  {
    id: id(),
    userId: userId(),
    captureId: uuid("capture_id")
      .notNull()
      .references(() => captures.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model"),
    promptVersion: text("prompt_version").notNull(),
    promptSha256: text("prompt_sha256").notNull(),
    outputSha256: text("output_sha256"),
    toolCalls: jsonb("tool_calls")
      .notNull()
      .default(sql`'[]'::jsonb`),
    proposalItemIds: uuid("proposal_item_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    validationErrorCodes: text("validation_error_codes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: harnessRunStatus("status").notNull(),
    latencyMs: integer("latency_ms"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    createdAt: createdAt(),
  },
  (t) => [index("harness_runs_capture_idx").on(t.captureId)],
).enableRLS();

export const harnessRunPayloads = pgTable(
  "harness_run_payloads",
  {
    id: id(),
    userId: userId(),
    harnessRunId: uuid("harness_run_id")
      .notNull()
      .references(() => harnessRuns.id, { onDelete: "cascade" }),
    rawPrompt: text("raw_prompt").notNull(),
    rawOutput: text("raw_output"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("harness_run_payloads_expires_idx").on(t.expiresAt)],
).enableRLS();

export const proposalItems = pgTable(
  "proposal_items",
  {
    id: id(),
    userId: userId(),
    captureId: uuid("capture_id")
      .notNull()
      .references(() => captures.id, { onDelete: "cascade" }),
    harnessRunId: uuid("harness_run_id").references(() => harnessRuns.id, {
      onDelete: "set null",
    }),
    kind: commandKind("kind").notNull(),
    payload: jsonb("payload").notNull(),
    originalPayload: jsonb("original_payload").notNull(),
    status: proposalStatus("status").notNull(),
    missingSlots: jsonb("missing_slots")
      .$type<MissingSlot[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    warnings: jsonb("warnings")
      .$type<Warning[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    source: provenanceSource("source").notNull(),
    model: text("model"),
    promptVersion: text("prompt_version"),
    confidence: confidence("confidence").notNull(),
    quote: text("quote").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    appliedEntityId: uuid("applied_entity_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("proposal_items_capture_idx").on(t.captureId),
    index("proposal_items_user_status_idx").on(t.userId, t.status),
  ],
).enableRLS();

const originItemId = () =>
  uuid("origin_item_id").references(() => proposalItems.id, { onDelete: "set null" });

export const scheduleBlocks = pgTable(
  "schedule_blocks",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    kind: blockKind("kind").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    fixed: boolean("fixed").notNull().default(false),
    seriesId: uuid("series_id"),
    origin: changeOrigin("origin").notNull(),
    originItemId: originItemId(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("schedule_blocks_user_starts_idx").on(t.userId, t.startsAt),
    check("schedule_blocks_ends_after_starts", sql`${t.endsAt} > ${t.startsAt}`),
  ],
).enableRLS();

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    kind: taskKind("kind").notNull(),
    dueOn: date("due_on"),
    priority: taskPriority("priority").notNull().default("medium"),
    status: taskStatus("status").notNull().default("open"),
    notes: text("notes"),
    details: jsonb("details")
      .$type<TaskDetails>()
      .notNull()
      .default(
        sql`'{"estimateMinutes":0,"nextAction":"","blocker":"","projectId":null,"subtasks":[],"sessions":[]}'::jsonb`,
      ),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    origin: changeOrigin("origin").notNull(),
    originItemId: originItemId(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tasks_user_status_idx").on(t.userId, t.status)],
).enableRLS();

export const observations = pgTable(
  "observations",
  {
    id: id(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    userId: userId(),
    category: observationCategory("category").notNull(),
    valueText: text("value_text").notNull(),
    valueNum: doublePrecision("value_num"),
    occurredOn: date("occurred_on").notNull(),
    source: observationSource("source").notNull(),
    quote: text("quote").notNull(),
    sensitivity: sensitivity("sensitivity").notNull().default("health"),
    origin: changeOrigin("origin").notNull(),
    originItemId: originItemId(),
    createdAt: createdAt(),
  },
  (t) => [index("observations_user_occurred_idx").on(t.userId, t.occurredOn)],
).enableRLS();

export const changeLog = pgTable(
  "change_log",
  {
    id: id(),
    sequence: bigserial("sequence", { mode: "number" }).notNull(),
    userId: userId(),
    mutationId: uuid("mutation_id").notNull(),
    entityType: entityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: changeAction("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    actor: actor("actor").notNull(),
    origin: changeOrigin("origin").notNull(),
    proposalItemId: uuid("proposal_item_id").references(() => proposalItems.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("change_log_user_created_idx").on(t.userId, t.createdAt),
    index("change_log_mutation_idx").on(t.mutationId),
    index("change_log_entity_idx").on(t.entityType, t.entityId),
  ],
).enableRLS();

export const lifeRecords = pgTable(
  "life_records",
  {
    id: id(),
    userId: userId(),
    type: text("type").notNull(),
    data: jsonb("data").$type<LifeRecord>().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("life_records_user_type_idx").on(t.userId, t.type),
    check("life_records_type_matches", sql`${t.data}->>'type' = ${t.type}`),
  ],
).enableRLS();
