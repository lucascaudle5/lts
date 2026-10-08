import type { LifeRecord, LifeRow, RecordOf } from "@/contracts/life";
import { addDaysIso, daysBetween, weekdayOf } from "./dates";
import { addMonths, format, parseISO } from "date-fns";

export function nextBillDate(date: string, recurrence: "weekly" | "monthly") {
  return recurrence === "weekly"
    ? addDaysIso(date, 7)
    : format(addMonths(parseISO(date), 1), "yyyy-MM-dd");
}

export function repeatDates(date: string, until: string, days: number[]): string[] {
  const span = daysBetween(date, until);
  if (span < 0 || span > 366) throw new Error("Choose a repeat end within one year of the start");
  const result = Array.from({ length: span + 1 }, (_, i) => addDaysIso(date, i)).filter((d) =>
    days.includes(weekdayOf(d)),
  );
  if (!result.length || result.length > 200)
    throw new Error("Choose between 1 and 200 occurrences");
  return result;
}

export function recordLinks(record: LifeRecord): Array<{ id: string; type?: string }> {
  switch (record.type) {
    case "habit_log":
      return [{ id: record.habitId, type: "habit" }];
    case "routine_run":
      return [{ id: record.routineId, type: "routine" }];
    case "workout":
      return record.planId ? [{ id: record.planId, type: "workout_plan" }] : [];
    case "meal_template":
      return record.foods.map((f) => ({ id: f.foodId, type: "food" }));
    case "review":
      return record.citedIds.map((id) => ({ id }));
    default:
      return [];
  }
}

export function recordsOf<T extends LifeRecord["type"]>(
  rows: LifeRow[],
  type: T,
): Array<LifeRow & { data: RecordOf<T> }> {
  return rows.filter((r) => r.data.type === type && !r.archivedAt) as Array<
    LifeRow & { data: RecordOf<T> }
  >;
}

export function mealTotals(rows: Array<{ data: RecordOf<"meal"> }>, date: string) {
  const meals = rows.filter((r) => r.data.date === date);
  return Object.fromEntries(
    (["calories", "protein", "carbs", "fat"] as const).map((key) => [
      key,
      {
        total: meals.reduce((sum, r) => sum + (r.data[key] ?? 0), 0),
        unknown: meals.filter((r) => r.data[key] === null).length,
      },
    ]),
  ) as Record<"calories" | "protein" | "carbs" | "fat", { total: number; unknown: number }>;
}

export function dueHabits(rows: LifeRow[], date: string) {
  const logs = recordsOf(rows, "habit_log");
  return recordsOf(rows, "habit")
    .filter((r) => r.data.days.includes(weekdayOf(date)))
    .sort((a, b) => Number(a.data.tier === "optional") - Number(b.data.tier === "optional"))
    .map((r) => ({
      ...r,
      log:
        logs
          .filter((l) => l.data.habitId === r.id && l.data.date === date)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
    }));
}

export function dueRoutines(rows: LifeRow[], date: string) {
  const logs = recordsOf(rows, "routine_run");
  return recordsOf(rows, "routine")
    .filter((r) => r.data.days.includes(weekdayOf(date)))
    .map((r) => ({
      ...r,
      log:
        logs
          .filter((l) => l.data.routineId === r.id && l.data.date === date)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
    }));
}

export function nextWorkout(rows: LifeRow[]) {
  const plans = recordsOf(rows, "workout_plan").sort(
    (a, b) => a.data.position - b.data.position || a.createdAt.localeCompare(b.createdAt),
  );
  const latest = recordsOf(rows, "workout")
    .filter((r) => r.data.outcome === "done" && r.data.planId)
    .sort(
      (a, b) => b.data.date.localeCompare(a.data.date) || b.createdAt.localeCompare(a.createdAt),
    )[0];
  const lastIndex = plans.findIndex((p) => p.id === latest?.data.planId);
  return plans.length ? plans[(lastIndex + 1) % plans.length] : null;
}
