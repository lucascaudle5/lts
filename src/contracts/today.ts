import { z } from "zod";

import { BlockKind, HhMm, IsoDate, ObservationCategory, TaskKind, Timezone, Uuid } from "./common";

/** Days after today that Today's "Upcoming" section covers. */
export const UPCOMING_DAYS = 7;

export const TodayBlock = z.object({
  id: Uuid,
  title: z.string(),
  blockKind: BlockKind,
  date: IsoDate,
  start: HhMm,
  end: HhMm,
  /** e.g. "2:00 PM – 7:00 PM"; ends on a later day get " (+1 day)". */
  timeLabel: z.string(),
  fixed: z.boolean(),
  /** Relative to the `now` the view was built for; only meaningful for today's blocks. */
  timing: z.enum(["past", "now", "later"]),
});
export type TodayBlock = z.infer<typeof TodayBlock>;

export const UpcomingDay = z.object({
  date: IsoDate,
  /** e.g. "Thu, Oct 8"; tomorrow is "Tomorrow". */
  label: z.string(),
  blocks: z.array(TodayBlock).min(1),
});
export type UpcomingDay = z.infer<typeof UpcomingDay>;

export const TodayTask = z.object({
  id: Uuid,
  title: z.string(),
  taskKind: TaskKind,
  dueOn: IsoDate.nullable(),
  /** e.g. "Due today", "Due Tue, Oct 13", or null when there is no due date. */
  dueLabel: z.string().nullable(),
  dueToday: z.boolean(),
  /** The due date has passed; shown plainly, never as a warning (Article 4). */
  pastDue: z.boolean(),
});
export type TodayTask = z.infer<typeof TodayTask>;

export const TodayObservation = z.object({
  id: Uuid,
  category: ObservationCategory,
  /** The user's own words. */
  valueText: z.string(),
});
export type TodayObservation = z.infer<typeof TodayObservation>;

/** What `getToday` returns: the read-only Today screen, already in the user's timezone. */
export const TodayView = z.object({
  date: IsoDate,
  timezone: Timezone,
  /** e.g. "Wednesday, October 7". */
  dateLabel: z.string(),
  blocks: z.array(TodayBlock),
  upcoming: z.array(UpcomingDay),
  openTasks: z.array(TodayTask),
  observations: z.array(TodayObservation),
  isEmpty: z.boolean(),
});
export type TodayView = z.infer<typeof TodayView>;
