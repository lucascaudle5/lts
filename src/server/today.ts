import "server-only";

import { format, parseISO } from "date-fns";

import type { IsoDate } from "@/contracts/common";
import {
  UPCOMING_DAYS,
  type TodayBlock,
  type TodayTask,
  type TodayView,
  type UpcomingDay,
} from "@/contracts/today";
import {
  addDaysIso,
  daysBetween,
  formatTime12h,
  instantToLocal,
  localDateTimeToInstant,
  todayInTimezone,
} from "@/domain/dates";
import type { Db } from "@/server/db/client";
import { listBlocksStartingBetween, type BlockRow } from "@/server/repositories/blocks";
import { listObservationsOn, type ObservationRow } from "@/server/repositories/observations";
import { listOpenTasks, type TaskRow } from "@/server/repositories/tasks";

export interface TodayInput {
  now: Date;
  timezone: string;
  /** Blocks starting from today 00:00 through the end of the upcoming window, any order. */
  blocks: BlockRow[];
  openTasks: TaskRow[];
  /** Observations dated today. */
  observations: ObservationRow[];
}

function shortDate(date: IsoDate): string {
  return format(parseISO(date), "EEE, MMM d");
}

function toTodayBlock(row: BlockRow, timezone: string, now: Date): TodayBlock {
  const start = instantToLocal(row.startsAt, timezone);
  const end = instantToLocal(row.endsAt, timezone);
  const extraDays = daysBetween(start.date, end.date);
  const suffix = extraDays > 0 ? ` (+${extraDays} day${extraDays === 1 ? "" : "s"})` : "";
  const timing =
    row.endsAt.getTime() <= now.getTime()
      ? "past"
      : row.startsAt.getTime() <= now.getTime()
        ? "now"
        : "later";
  return {
    id: row.id,
    title: row.title,
    blockKind: row.kind,
    date: start.date,
    start: start.time,
    end: end.time,
    timeLabel: `${formatTime12h(start.time)} – ${formatTime12h(end.time)}${suffix}`,
    fixed: row.fixed,
    timing,
    provenance:
      row.captureId && row.captureDate
        ? { captureId: row.captureId, referenceDate: row.captureDate }
        : null,
  };
}

function toTodayTask(row: TaskRow, today: IsoDate): TodayTask {
  const dueOn = row.dueOn ?? null;
  const dueToday = dueOn === today;
  return {
    id: row.id,
    title: row.title,
    taskKind: row.kind,
    dueOn,
    dueLabel: dueOn === null ? null : dueToday ? "Due today" : `Due ${shortDate(dueOn)}`,
    dueToday,
    pastDue: dueOn !== null && daysBetween(today, dueOn) < 0,
    provenance:
      row.captureId && row.captureDate
        ? { captureId: row.captureId, referenceDate: row.captureDate }
        : null,
  };
}

/** Pure: turns rows into the Today screen for the user's timezone at `now`. */
export function buildTodayView(input: TodayInput): TodayView {
  const { now, timezone } = input;
  const date = todayInTimezone(now, timezone);
  const lastUpcoming = addDaysIso(date, UPCOMING_DAYS);

  const blocks = [...input.blocks]
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id))
    .map((row) => toTodayBlock(row, timezone, now));

  const todayBlocks = blocks.filter((b) => b.date === date);
  const upcomingByDate = new Map<IsoDate, TodayBlock[]>();
  for (const block of blocks) {
    if (block.date <= date || block.date > lastUpcoming) continue;
    upcomingByDate.set(block.date, [...(upcomingByDate.get(block.date) ?? []), block]);
  }
  const tomorrow = addDaysIso(date, 1);
  const upcoming: UpcomingDay[] = [...upcomingByDate.entries()].map(([day, dayBlocks]) => ({
    date: day,
    label: day === tomorrow ? "Tomorrow" : shortDate(day),
    blocks: dayBlocks,
  }));

  const openTasks = input.openTasks.map((row) => toTodayTask(row, date));
  const observations = input.observations
    .filter((row) => row.occurredOn === date)
    .map((row) => ({
      id: row.id,
      category: row.category,
      valueText: row.valueText,
      provenance:
        row.captureId && row.captureDate
          ? { captureId: row.captureId, referenceDate: row.captureDate }
          : null,
    }));

  return {
    date,
    timezone,
    dateLabel: format(parseISO(date), "EEEE, MMMM d"),
    blocks: todayBlocks,
    upcoming,
    openTasks,
    observations,
    isEmpty:
      todayBlocks.length === 0 &&
      upcoming.length === 0 &&
      openTasks.length === 0 &&
      observations.length === 0,
  };
}

/** `getToday` from the slice spec: reads only this user's rows. */
export async function getToday(
  userId: string,
  timezone: string,
  now: Date,
  db?: Db,
): Promise<TodayView> {
  const date = todayInTimezone(now, timezone);
  const from = localDateTimeToInstant(date, "00:00", timezone);
  const to = localDateTimeToInstant(addDaysIso(date, UPCOMING_DAYS + 1), "00:00", timezone);
  const [blocks, openTasks, observations] = await Promise.all([
    listBlocksStartingBetween(userId, { from, to }, db),
    listOpenTasks(userId, {}, db),
    listObservationsOn(userId, date, db),
  ]);
  return buildTodayView({ now, timezone, blocks, openTasks, observations });
}
