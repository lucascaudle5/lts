import { getDay, parseISO } from "date-fns";

import type { LifeRow, RecordOf, WorkspaceData } from "@/contracts/life";
import type { TodayBlock, TodayView } from "@/contracts/today";

export type Daypart = "morning" | "afternoon" | "evening";
/** How the day looks, from the schedule alone. Never from how the person says they feel. */
export type DayLoad = "empty" | "open" | "heavy" | "done";

export interface FloorItem {
  id: string;
  title: string;
  anchor: string;
  done: boolean;
  /** What "the small version" records: the habit's own target. */
  target: number;
}

export interface RoutineItem {
  id: string;
  title: string;
  anchor: string;
  minimum: string[];
  /** e.g. "minimum done" once something is logged for today. */
  loggedLabel: string | null;
}

export interface TodayModel {
  daypart: Daypart;
  load: DayLoad;
  greeting: string;
  note: string;
  upNext: { block: TodayBlock; now: boolean } | null;
  laterToday: TodayBlock[];
  earlier: TodayBlock[];
  tomorrowFirst: TodayBlock | null;
  floor: FloorItem[];
  routines: RoutineItem[];
  floorRemaining: number;
}

const HEAVY_BLOCKS = 5;
const HEAVY_FIXED = 4;
const HEAVY_MINUTES = 8 * 60;

export function daypartOf(hour: number): Daypart {
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

function minutesOf(block: TodayBlock): number {
  const [sh, sm] = block.start.split(":").map(Number);
  const [eh, em] = block.end.split(":").map(Number);
  const span = eh! * 60 + em! - (sh! * 60 + sm!);
  return span > 0 ? span : span + 24 * 60;
}

/** A full day is a matter of the calendar: many blocks, many fixed ones, or a long stretch. */
export function isHeavyDay(blocks: readonly TodayBlock[]): boolean {
  return (
    blocks.length >= HEAVY_BLOCKS ||
    blocks.filter((b) => b.fixed).length >= HEAVY_FIXED ||
    blocks.reduce((sum, b) => sum + minutesOf(b), 0) >= HEAVY_MINUTES
  );
}

function rows(data: WorkspaceData, type: string) {
  return data.records.filter((r) => !r.archivedAt && r.data.type === type) as LifeRow[];
}

export function buildTodayModel(view: TodayView, data: WorkspaceData): TodayModel {
  const weekday = getDay(parseISO(data.today));
  const habitLogs = rows(data, "habit_log") as Array<LifeRow & { data: RecordOf<"habit_log"> }>;
  const floor: FloorItem[] = (rows(data, "habit") as Array<LifeRow & { data: RecordOf<"habit"> }>)
    .filter((h) => h.data.tier === "floor" && h.data.days.includes(weekday))
    .map((h) => ({
      id: h.id,
      title: h.data.title,
      anchor: h.data.anchor,
      target: h.data.target,
      done: habitLogs.some(
        (l) => l.data.habitId === h.id && l.data.date === data.today && l.data.outcome === "done",
      ),
    }));

  const runs = rows(data, "routine_run") as Array<LifeRow & { data: RecordOf<"routine_run"> }>;
  const routines: RoutineItem[] = (
    rows(data, "routine") as Array<LifeRow & { data: RecordOf<"routine"> }>
  )
    .filter((r) => r.data.days.includes(weekday))
    .map((r) => {
      const run = runs.find((l) => l.data.routineId === r.id && l.data.date === data.today);
      return {
        id: r.id,
        title: r.data.title,
        anchor: r.data.anchor,
        minimum: r.data.minimum,
        loggedLabel: run ? `${run.data.variant} version` : null,
      };
    });

  const daypart = daypartOf(view.localHour);
  const floorRemaining = floor.filter((f) => !f.done).length;
  const earlier = view.blocks.filter((b) => b.timing === "past");
  const current = view.blocks.find((b) => b.timing === "now");
  const later = view.blocks.filter((b) => b.timing === "later");
  const upNext = current
    ? { block: current, now: true }
    : later[0]
      ? { block: later[0], now: false }
      : null;
  const laterToday = later.filter((b) => b.id !== upNext?.block.id);
  const tomorrowFirst = view.upcoming.find((d) => d.label === "Tomorrow")?.blocks[0] ?? null;

  const hasAnything =
    view.blocks.length > 0 ||
    view.openTasks.length > 0 ||
    view.observations.length > 0 ||
    view.upcoming.length > 0 ||
    floor.length > 0 ||
    routines.length > 0 ||
    !view.isEmpty;
  const nothingLeft =
    !current &&
    later.length === 0 &&
    floorRemaining === 0 &&
    !view.openTasks.some((t) => t.dueToday || t.pastDue);
  const worthCalling = view.blocks.length > 0 || (floor.length > 0 && daypart === "evening");

  const load: DayLoad = !hasAnything
    ? "empty"
    : worthCalling && nothingLeft
      ? "done"
      : isHeavyDay(view.blocks)
        ? "heavy"
        : "open";

  const greeting =
    load === "done"
      ? "That's the day."
      : daypart === "morning"
        ? "Good morning."
        : daypart === "afternoon"
          ? "Good afternoon."
          : "Good evening.";

  const note =
    load === "empty"
      ? "A clear day. Tell me what's on it, or leave it open."
      : load === "heavy"
        ? "Today looks full. Here's the floor if you want it."
        : load === "done"
          ? tomorrowFirst
            ? `Tomorrow starts with ${tomorrowFirst.title} at ${tomorrowFirst.timeLabel.split(" – ")[0]}.`
            : "Nothing else is waiting on you tonight."
          : floor.length === 0
            ? ""
            : floorRemaining === 0
              ? "Your floor is covered."
              : `${floorRemaining} small ${floorRemaining === 1 ? "thing" : "things"} on your floor today.`;

  return {
    daypart,
    load,
    greeting,
    note,
    upNext,
    laterToday,
    earlier,
    tomorrowFirst,
    floor,
    routines,
    floorRemaining,
  };
}
