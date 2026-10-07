import { z } from "zod";

import {
  BlockKind,
  HhMm,
  IsoDate,
  ObservationCategory,
  TaskKind,
  TaskStatus,
  Uuid,
} from "./common";
import { SubmitProposals } from "./proposals";

export const MAX_SCHEDULE_WINDOW_DAYS = 14;
export const MAX_OPEN_TASKS = 50;
export const MAX_OBSERVATION_WINDOW_DAYS = 14;

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000;
}

export const ToolName = z.enum([
  "get_today",
  "get_schedule",
  "list_open_tasks",
  "get_recent_observations",
  "submit_proposals",
]);
export type ToolName = z.infer<typeof ToolName>;

export const ToolBlock = z.object({
  id: Uuid,
  title: z.string(),
  blockKind: BlockKind,
  date: IsoDate,
  start: HhMm,
  end: HhMm,
  fixed: z.boolean(),
});
export type ToolBlock = z.infer<typeof ToolBlock>;

export const ToolTask = z.object({
  id: Uuid,
  title: z.string(),
  taskKind: TaskKind,
  dueOn: IsoDate.nullable(),
  status: TaskStatus,
});
export type ToolTask = z.infer<typeof ToolTask>;

export const ToolObservation = z.object({
  id: Uuid,
  category: ObservationCategory,
  valueText: z.string(),
  occurredOn: IsoDate,
});
export type ToolObservation = z.infer<typeof ToolObservation>;

export const GetTodayInput = z.object({ date: IsoDate }).strict();
export const GetTodayOutput = z.object({
  date: IsoDate,
  blocks: z.array(ToolBlock),
  openTaskCount: z.number().int().nonnegative(),
});

export const GetScheduleInput = z
  .object({ from: IsoDate, to: IsoDate })
  .strict()
  .refine((v) => daysBetween(v.from, v.to) >= 0, "`to` must not be before `from`")
  .refine(
    (v) => daysBetween(v.from, v.to) < MAX_SCHEDULE_WINDOW_DAYS,
    `Window is limited to ${MAX_SCHEDULE_WINDOW_DAYS} days`,
  );
export const GetScheduleOutput = z.object({ blocks: z.array(ToolBlock) });

export const ListOpenTasksInput = z
  .object({ limit: z.number().int().min(1).max(MAX_OPEN_TASKS).default(MAX_OPEN_TASKS) })
  .strict();
/** Titles and due dates only. */
export const ListOpenTasksOutput = z.object({
  tasks: z.array(ToolTask.pick({ id: true, title: true, dueOn: true })).max(MAX_OPEN_TASKS),
});

export const GetRecentObservationsInput = z
  .object({
    days: z.number().int().min(1).max(MAX_OBSERVATION_WINDOW_DAYS),
    categories: z.array(ObservationCategory).min(1),
  })
  .strict();
export const GetRecentObservationsOutput = z.object({ observations: z.array(ToolObservation) });

export const toolInputSchemas = {
  get_today: GetTodayInput,
  get_schedule: GetScheduleInput,
  list_open_tasks: ListOpenTasksInput,
  get_recent_observations: GetRecentObservationsInput,
  submit_proposals: SubmitProposals,
} as const satisfies Record<ToolName, z.ZodType>;
