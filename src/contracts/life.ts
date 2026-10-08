import { z } from "zod";

import { HhMm, IsoDate, Timezone, Uuid } from "./common";
import { ScheduleBlockCreate, TaskDetails } from "./commands";
import { BlockKind, TaskKind, TaskPriority, TaskStatus, ObservationCategory } from "./common";

const title = z.string().trim().min(1).max(120);
const notes = z.string().max(4000).default("");
const amount = z.number().finite().min(0).max(1000000);
const optionalNumber = amount.nullable().default(null);
const days = z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]);
const steps = z.array(title).min(1).max(30);
const common = { title, notes, collection: z.string().max(120).optional() };

/** Stored records stay typed and versionable; no arbitrary legacy state enters the database. */
export const LifeRecord = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("habit"),
    ...common,
    tier: z.enum(["floor", "optional"]).default("floor"),
    unit: z.enum(["check", "count", "minutes"]).default("check"),
    target: amount.min(1).default(1),
    days,
    anchor: z.string().max(120).default(""),
  }),
  z.object({
    type: z.literal("habit_log"),
    ...common,
    habitId: Uuid,
    date: IsoDate,
    outcome: z.enum(["done", "partial", "skipped"]),
    value: amount.default(1),
  }),
  z.object({
    type: z.literal("routine"),
    ...common,
    anchor: z.string().max(120).default(""),
    days,
    full: steps,
    short: steps,
    minimum: steps,
    minutes: z.number().int().min(1).max(300).default(15),
  }),
  z.object({
    type: z.literal("routine_run"),
    ...common,
    routineId: Uuid,
    date: IsoDate,
    variant: z.enum(["full", "short", "minimum"]),
    outcome: z.enum(["done", "partial", "skipped"]),
    completedSteps: z.array(z.string().max(120)).max(30).default([]),
  }),
  z.object({
    type: z.literal("workout_plan"),
    ...common,
    exercises: z.string().min(1).max(4000),
    substitutions: z.string().max(4000).default(""),
    position: z.number().int().min(1).max(100).default(1),
    minutes: z.number().int().min(1).max(300).default(45),
  }),
  z.object({
    type: z.literal("exercise"),
    ...common,
    equipment: z.string().max(200).default(""),
    instructions: z.string().max(4000).default(""),
    substitutions: z.string().max(4000).default(""),
  }),
  z.object({
    type: z.literal("workout"),
    ...common,
    date: IsoDate,
    planId: Uuid.nullable().default(null),
    exercises: z.string().min(1).max(4000),
    minutes: optionalNumber,
    effort: z.enum(["easy", "moderate", "hard", "not_recorded"]).default("not_recorded"),
    outcome: z.enum(["done", "partial", "skipped"]).default("done"),
  }),
  z.object({
    type: z.literal("body_log"),
    ...common,
    date: IsoDate,
    weight: amount.positive(),
    unit: z.enum(["lb", "kg"]),
  }),
  z.object({
    type: z.literal("food"),
    ...common,
    serving: z.string().min(1).max(120),
    calories: optionalNumber,
    protein: optionalNumber,
    carbs: optionalNumber,
    fat: optionalNumber,
    favorite: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("meal_template"),
    ...common,
    foods: z
      .array(z.object({ foodId: Uuid, servings: amount.positive().max(100) }))
      .min(1)
      .max(30),
  }),
  z.object({
    type: z.literal("meal"),
    ...common,
    date: IsoDate,
    time: HhMm.nullable().default(null),
    calories: optionalNumber,
    protein: optionalNumber,
    carbs: optionalNumber,
    fat: optionalNumber,
    window: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("snack"),
  }),
  z.object({
    type: z.literal("nutrition_targets"),
    ...common,
    calories: optionalNumber,
    protein: optionalNumber,
    carbs: optionalNumber,
    fat: optionalNumber,
  }),
  z.object({
    type: z.literal("state"),
    ...common,
    date: IsoDate,
    sleepHours: optionalNumber.refine(
      (v) => v === null || v <= 24,
      "Sleep hours must be between 0 and 24",
    ),
    sleepStart: HhMm.nullable().default(null),
    sleepEnd: HhMm.nullable().default(null),
    energy: z.string().max(200).default(""),
    mood: z.string().max(200).default(""),
    stress: z.string().max(200).default(""),
    capacity: z.string().max(200).default(""),
  }),
  z.object({
    type: z.literal("project"),
    ...common,
    status: z.enum(["active", "parked", "done"]).default("active"),
    nextAction: z.string().max(300).default(""),
    dueOn: IsoDate.nullable().default(null),
    frontier: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("money"),
    ...common,
    date: IsoDate,
    amount,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("USD"),
    direction: z.enum(["expense", "income", "bill"]),
    category: z.string().max(120).default(""),
    paid: z.boolean().default(false),
    recurrence: z.enum(["none", "weekly", "monthly"]).default("none"),
    seriesId: Uuid.nullable().optional(),
  }),
  z
    .object({
      type: z.literal("review"),
      ...common,
      from: IsoDate,
      to: IsoDate,
      decisions: z.string().max(4000).default(""),
      citedIds: z.array(Uuid).max(100).default([]),
    })
    .refine((v) => v.to >= v.from, "Review end must follow start"),
]);
export type LifeRecord = z.infer<typeof LifeRecord>;
export type LifeType = LifeRecord["type"];
export type RecordOf<T extends LifeType> = Extract<LifeRecord, { type: T }>;
export interface LifeRow {
  id: string;
  data: LifeRecord;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const WorkspaceOperation = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("record.save"),
    id: Uuid.optional(),
    record: LifeRecord,
    expectedUpdatedAt: z.string().optional(),
  }),
  z.object({ op: z.literal("record.archive"), id: Uuid, archive: z.boolean() }),
  z.object({ op: z.literal("record.collection"), id: Uuid, collection: z.string().max(120) }),
  z.object({ op: z.literal("money.pay"), id: Uuid }),
  z.object({
    op: z.literal("observation.save"),
    id: Uuid,
    category: ObservationCategory,
    valueText: z.string().trim().min(1).max(200),
    occurredOn: IsoDate,
  }),
  z.object({ op: z.literal("observation.archive"), id: Uuid, archive: z.boolean() }),
  z.object({
    op: z.literal("schedule.save"),
    id: Uuid.optional(),
    block: ScheduleBlockCreate,
    repeat: z.object({ until: IsoDate, days: days }).optional(),
    expectedUpdatedAt: z.string().optional(),
    allowOverlap: z.boolean().default(false),
  }),
  z.object({
    op: z.literal("schedule.archive"),
    id: Uuid,
    archive: z.boolean(),
    series: z.boolean().default(false),
  }),
  z.object({ op: z.literal("task.archive"), id: Uuid, archive: z.boolean() }),
  z.object({
    op: z.literal("profile.save"),
    timezone: Timezone,
    authority: z.enum(["ask", "allow_explicit"]),
  }),
  z.object({ op: z.literal("undo"), changeId: Uuid }),
]);
export type WorkspaceOperation = z.infer<typeof WorkspaceOperation>;
export interface ScheduleRow {
  id: string;
  title: string;
  kind: string;
  date: string;
  start: string;
  end: string;
  fixed: boolean;
  seriesId: string | null;
  archivedAt: string | null;
  updatedAt: string;
}
export interface HistoryRow {
  id: string;
  entityId: string;
  entityType: string;
  action: string;
  origin: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}
export interface WorkspaceTask {
  id: string;
  title: string;
  kind: string;
  dueOn: string | null;
  priority: string;
  status: string;
  notes: string | null;
  details: TaskDetails;
  archivedAt: string | null;
  updatedAt?: string;
}
export interface WorkspaceData {
  today: string;
  timezone: string;
  authority: "ask" | "allow_explicit";
  records: LifeRow[];
  schedule: ScheduleRow[];
  tasks: WorkspaceTask[];
  history: HistoryRow[];
  observations: Array<{
    id: string;
    category: string;
    valueText: string;
    occurredOn: string;
    archivedAt?: string | null;
  }>;
  captures: Array<{ id: string; text: string; date: string; pending: number }>;
}

export const UserBackup = z
  .object({
    version: z.literal(1),
    records: z
      .array(z.object({ id: Uuid, data: LifeRecord, archivedAt: z.string().nullable().optional() }))
      .max(500)
      .default([]),
    tasks: z
      .array(
        z.object({
          id: Uuid,
          title: z.string().min(1).max(120),
          kind: TaskKind,
          dueOn: IsoDate.nullable(),
          priority: TaskPriority.default("medium"),
          status: TaskStatus,
          notes: z.string().max(1000).nullable(),
          details: TaskDetails.optional(),
          deletedAt: z.string().nullable().optional(),
        }),
      )
      .max(500)
      .default([]),
    blocks: z
      .array(
        z.object({
          title: z.string().min(1).max(120),
          kind: BlockKind,
          startsAt: z.iso.datetime({ offset: true }),
          id: Uuid.optional(),
          endsAt: z.iso.datetime({ offset: true }),
          fixed: z.boolean(),
          deletedAt: z.string().nullable().optional(),
        }),
      )
      .max(500)
      .default([]),
    observations: z
      .array(
        z.object({
          category: ObservationCategory,
          id: Uuid.optional(),
          deletedAt: z.string().nullable().optional(),
          valueText: z.string().min(1).max(200),
          valueNum: z.number().finite().nullable().optional(),
          occurredOn: IsoDate,
        }),
      )
      .max(500)
      .default([]),
  })
  .refine(
    (value) =>
      value.records.length + value.tasks.length + value.blocks.length + value.observations.length <=
      500,
    "Import at most 500 records at a time",
  );
export type UserBackup = z.infer<typeof UserBackup>;

/** A browser-only dry run, separate from the durable account backup format. */
export const SandboxSnapshot = z.object({
  today: IsoDate,
  timezone: Timezone,
  records: z
    .array(
      z.object({
        id: Uuid,
        data: LifeRecord,
        archivedAt: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    )
    .max(500),
  tasks: z
    .array(
      z.object({
        id: Uuid,
        title: z.string().min(1).max(120),
        kind: TaskKind,
        dueOn: IsoDate.nullable(),
        priority: TaskPriority,
        status: TaskStatus,
        notes: z.string().nullable(),
        details: TaskDetails,
        archivedAt: z.string().nullable(),
        updatedAt: z.string().optional(),
      }),
    )
    .max(500),
  schedule: z
    .array(
      z.object({
        id: Uuid,
        title: z.string().min(1).max(120),
        kind: BlockKind,
        date: IsoDate,
        start: HhMm,
        end: HhMm,
        fixed: z.boolean(),
        seriesId: Uuid.nullable(),
        archivedAt: z.string().nullable(),
        updatedAt: z.string(),
      }),
    )
    .max(500),
  observations: z
    .array(
      z.object({
        id: Uuid,
        category: ObservationCategory,
        valueText: z.string().max(200),
        occurredOn: IsoDate,
        archivedAt: z.string().nullable().optional(),
      }),
    )
    .max(500),
});
