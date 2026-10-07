import { TZDate } from "@date-fns/tz";
import { addDays, format, getDay, parseISO } from "date-fns";

import type { HhMm, IsoDate, WarningCode } from "@/contracts/common";

/** Sunday = 0 … Saturday = 6, matching `Date#getDay`. */
const WEEKDAY_BY_PREFIX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const WEEKDAY_PATTERN =
  /\b(?:(next|this)\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)\b/gi;
const RELATIVE_DAY_PATTERN = /\b(today|tonight|tomorrow|tmrw)\b/gi;

export interface DateExpression {
  date: IsoDate;
  /** The words in the text that produced the date. */
  match: string;
  index: number;
  warnings: WarningCode[];
}

export interface TimeRange {
  start: HhMm;
  end: HhMm;
  match: string;
  index: number;
  warnings: WarningCode[];
}

function isoFromDate(date: Date): IsoDate {
  return format(date, "yyyy-MM-dd");
}

export function addDaysIso(date: IsoDate, days: number): IsoDate {
  return isoFromDate(addDays(parseISO(date), days));
}

export function weekdayOf(date: IsoDate): number {
  return getDay(parseISO(date));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Monday-based index: Monday = 0 … Sunday = 6. */
function mondayIndex(weekday: number): number {
  return (weekday + 6) % 7;
}

/**
 * A bare weekday ("saturday", "sat") is the next occurrence on or after the reference date.
 * "next <weekday>" is that weekday in the following Monday-based week.
 */
export function resolveWeekday(
  weekday: number,
  referenceDate: IsoDate,
  mode: "upcoming" | "next_week" = "upcoming",
): IsoDate {
  const refWeekday = weekdayOf(referenceDate);
  if (mode === "next_week") {
    const nextMonday = addDaysIso(referenceDate, 7 - mondayIndex(refWeekday));
    return addDaysIso(nextMonday, mondayIndex(weekday));
  }
  return addDaysIso(referenceDate, (weekday - refWeekday + 7) % 7);
}

/** Every date word in `text`, in order of appearance. */
export function findDateExpressions(text: string, referenceDate: IsoDate): DateExpression[] {
  const found: DateExpression[] = [];

  for (const m of text.matchAll(RELATIVE_DAY_PATTERN)) {
    const word = m[1].toLowerCase();
    const offset = word === "today" || word === "tonight" ? 0 : 1;
    found.push({
      date: addDaysIso(referenceDate, offset),
      match: m[0],
      index: m.index,
      warnings: [],
    });
  }

  for (const m of text.matchAll(WEEKDAY_PATTERN)) {
    const qualifier = m[1]?.toLowerCase();
    const weekday = WEEKDAY_BY_PREFIX[m[2].slice(0, 3).toLowerCase()];
    const date = resolveWeekday(
      weekday,
      referenceDate,
      qualifier === "next" ? "next_week" : "upcoming",
    );
    const warnings: WarningCode[] = ["date_from_weekday"];
    if (date === referenceDate) warnings.push("date_is_today");
    found.push({ date, match: m[0], index: m.index, warnings });
  }

  return found.sort((a, b) => a.index - b.index);
}

export function resolveDateExpression(text: string, referenceDate: IsoDate): DateExpression | null {
  return findDateExpressions(text, referenceDate)[0] ?? null;
}

const TIME_RANGE_PATTERN =
  /(?<![\d:/-])(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|—|to|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?![\d/-])/gi;

type Meridiem = "am" | "pm";

function meridiemOf(raw: string | undefined): Meridiem | undefined {
  if (!raw) return undefined;
  return raw.toLowerCase().startsWith("a") ? "am" : "pm";
}

function to24(hour: number, meridiem: Meridiem): number {
  if (meridiem === "am") return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function hhmm(hour: number, minute: number): HhMm {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Resolves the first time range in `text` ("2-7", "3-4pm", "7am-8am", "14:00–19:00").
 * Without any am/pm, starts from 1 to 7 are read as afternoon and flagged `time_assumed_pm`,
 * because people rarely schedule 2-7 AM; an explicit meridiem is never overridden.
 * The result can have `end <= start` (e.g. "8pm-7pm"); validation turns that into a slot.
 */
export function parseTimeRange(text: string): TimeRange | null {
  for (const m of text.matchAll(TIME_RANGE_PATTERN)) {
    const sh = Number(m[1]);
    const sm = m[2] ? Number(m[2]) : 0;
    const eh = Number(m[4]);
    const em = m[5] ? Number(m[5]) : 0;
    const sMer = meridiemOf(m[3]);
    const eMer = meridiemOf(m[6]);

    if (sm > 59 || em > 59) continue;
    if ((sMer && (sh < 1 || sh > 12)) || (eMer && (eh < 1 || eh > 12))) continue;
    if (sh > 23 || eh > 23) continue;

    const warnings: WarningCode[] = [];
    let start: number;
    let end: number;

    if (sMer && eMer) {
      start = to24(sh, sMer);
      end = to24(eh, eMer);
    } else if (eMer) {
      end = to24(eh, eMer);
      start = to24(sh, eMer);
      if (start * 60 + sm >= end * 60 + em) start = to24(sh, eMer === "am" ? "pm" : "am");
    } else if (sMer) {
      start = to24(sh, sMer);
      end = to24(eh, sMer);
      if (end * 60 + em <= start * 60 + sm) end = to24(eh, sMer === "am" ? "pm" : "am");
    } else if (sh === 0 || sh > 12 || eh === 0 || eh > 12) {
      start = sh;
      end = eh;
    } else {
      start = sh;
      if (sh >= 1 && sh <= 7) {
        start = sh + 12;
        warnings.push("time_assumed_pm");
      }
      end = eh;
      if (end * 60 + em <= start * 60 + sm && eh < 12) {
        end = eh + 12;
        if (!warnings.includes("time_assumed_pm")) warnings.push("time_assumed_pm");
      }
    }

    if (end > 23) continue;
    return {
      start: hhmm(start, sm),
      end: hhmm(end, em),
      match: m[0],
      index: m.index,
      warnings,
    };
  }
  return null;
}

export function compareTimes(a: HhMm, b: HhMm): number {
  return a.localeCompare(b);
}

/** "14:00" → "2:00 PM". */
export function formatTime12h(time: HhMm): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** The instant at which `date` + `time` happens on the wall clock in `timezone`. */
export function localDateTimeToInstant(date: IsoDate, time: HhMm, timezone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(new TZDate(y, mo - 1, d, h, mi, timezone).getTime());
}

export function instantToLocal(instant: Date, timezone: string): { date: IsoDate; time: HhMm } {
  const local = new TZDate(instant.getTime(), timezone);
  return { date: format(local, "yyyy-MM-dd"), time: format(local, "HH:mm") };
}

/** The calendar date in `timezone` at instant `now` (callers pass `now`; domain never reads the clock). */
export function todayInTimezone(now: Date, timezone: string): IsoDate {
  return instantToLocal(now, timezone).date;
}
