import { z } from "zod";

import {
  BlockKind,
  HhMm,
  IsoDate,
  ObservationCategory,
  TaskKind,
  TaskPriority,
  TaskStatus,
  Uuid,
} from "./common";

export const ScheduleBlockCreate = z.object({
  title: z.string().trim().min(1).max(120),
  blockKind: BlockKind,
  date: IsoDate,
  start: HhMm,
  end: HhMm,
  fixed: z.boolean().default(false),
});
export type ScheduleBlockCreate = z.infer<typeof ScheduleBlockCreate>;

export const TaskDetails = z.object({
  estimateMinutes: z.number().int().min(0).max(100000).default(0),
  nextAction: z.string().max(300).default(""),
  blocker: z.string().max(300).default(""),
  projectId: Uuid.nullable().default(null),
  subtasks: z
    .array(z.object({ title: z.string().trim().min(1).max(120), done: z.boolean() }))
    .max(50)
    .default([]),
  sessions: z
    .array(
      z.object({
        date: IsoDate,
        minutes: z.number().int().min(1).max(1440),
        notes: z.string().max(1000).default(""),
      }),
    )
    .max(500)
    .default([]),
});
export type TaskDetails = z.infer<typeof TaskDetails>;

export const TaskCreate = z.object({
  title: z.string().trim().min(1).max(120),
  taskKind: TaskKind,
  dueOn: IsoDate.optional(),
  priority: TaskPriority.optional(),
  notes: z.string().max(1000).optional(),
  details: TaskDetails.optional(),
});
export type TaskCreate = z.infer<typeof TaskCreate>;

export const TaskUpdate = z
  .object({
    taskId: Uuid,
    expectedUpdatedAt: z.iso.datetime().optional(),
    title: z.string().trim().min(1).max(120).optional(),
    taskKind: TaskKind.optional(),
    status: TaskStatus.optional(),
    priority: TaskPriority.optional(),
    dueOn: IsoDate.nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    details: TaskDetails.optional(),
  })
  .refine(
    (input) =>
      input.title !== undefined ||
      input.taskKind !== undefined ||
      input.status !== undefined ||
      input.priority !== undefined ||
      input.dueOn !== undefined ||
      input.notes !== undefined ||
      input.details !== undefined,
    {
      message: "Change at least one task field",
    },
  );
export type TaskUpdate = z.infer<typeof TaskUpdate>;

export const ObservationRecord = z.object({
  category: ObservationCategory,
  /** The user's own words. */
  valueText: z.string().trim().min(1).max(200),
  /** Only when the user stated a number. */
  valueNum: z.number().finite().optional(),
  occurredOn: IsoDate,
});
export type ObservationRecord = z.infer<typeof ObservationRecord>;

/**
 * Command kinds accepted by the mutation layer. Proposals use a subset; commands such as
 * `task.update` can be manual-only and don't need an approval-card representation.
 */
export const CommandKind = z.enum([
  "schedule_block.create",
  "task.create",
  "task.update",
  "observation.record",
]);
export type CommandKind = z.infer<typeof CommandKind>;

export const commandPayloadSchemas = {
  "schedule_block.create": ScheduleBlockCreate,
  "task.create": TaskCreate,
  "task.update": TaskUpdate,
  "observation.record": ObservationRecord,
} as const satisfies Record<CommandKind, z.ZodType>;

export type PayloadFor<K extends CommandKind> = z.infer<(typeof commandPayloadSchemas)[K]>;

export const DomainCommand = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("schedule_block.create"), payload: ScheduleBlockCreate }),
  z.object({ kind: z.literal("task.create"), payload: TaskCreate }),
  z.object({ kind: z.literal("task.update"), payload: TaskUpdate }),
  z.object({ kind: z.literal("observation.record"), payload: ObservationRecord }),
]);
export type DomainCommand = z.infer<typeof DomainCommand>;
