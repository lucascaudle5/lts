import { z } from "zod";

import { BlockKind, HhMm, IsoDate, ObservationCategory, TaskKind } from "./common";

export const ScheduleBlockCreate = z.object({
  title: z.string().trim().min(1).max(120),
  blockKind: BlockKind,
  date: IsoDate,
  start: HhMm,
  end: HhMm,
  fixed: z.boolean().default(false),
});
export type ScheduleBlockCreate = z.infer<typeof ScheduleBlockCreate>;

export const TaskCreate = z.object({
  title: z.string().trim().min(1).max(120),
  taskKind: TaskKind,
  dueOn: IsoDate.optional(),
  notes: z.string().max(1000).optional(),
});
export type TaskCreate = z.infer<typeof TaskCreate>;

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
 * Command kinds the mutation layer accepts. Proposal kinds are the same union, so an approved
 * proposal maps 1:1 to a command. Update/delete (M5) and `routine_run.log` (M6) join later.
 */
export const CommandKind = z.enum(["schedule_block.create", "task.create", "observation.record"]);
export type CommandKind = z.infer<typeof CommandKind>;

export const commandPayloadSchemas = {
  "schedule_block.create": ScheduleBlockCreate,
  "task.create": TaskCreate,
  "observation.record": ObservationRecord,
} as const satisfies Record<CommandKind, z.ZodType>;

export type PayloadFor<K extends CommandKind> = z.infer<(typeof commandPayloadSchemas)[K]>;

export const DomainCommand = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("schedule_block.create"), payload: ScheduleBlockCreate }),
  z.object({ kind: z.literal("task.create"), payload: TaskCreate }),
  z.object({ kind: z.literal("observation.record"), payload: ObservationRecord }),
]);
export type DomainCommand = z.infer<typeof DomainCommand>;
