import { describe, expect, it } from "vitest";
import { LifeRecord, type LifeRow } from "@/contracts/life";
import { dueHabits, dueRoutines, mealTotals, nextWorkout, repeatDates } from "./life";

const row = (id: string, data: unknown, archivedAt: string | null = null): LifeRow => ({
  id,
  data: LifeRecord.parse(data),
  archivedAt,
  createdAt: "2026-10-08T12:00:00Z",
  updatedAt: "2026-10-08T12:00:00Z",
});
describe("life behavior", () => {
  it("expands calendar recurrence without shifting weekdays across DST", () => {
    expect(repeatDates("2026-10-26", "2026-11-09", [1])).toEqual([
      "2026-10-26",
      "2026-11-02",
      "2026-11-09",
    ]);
    expect(() => repeatDates("2026-10-08", "2027-12-09", [1])).toThrow("one year");
    expect(() => repeatDates("2026-10-08", "2026-10-08", [1])).toThrow("occurrences");
  });
  it("puts the floor first and respects explicit days and archived habits", () => {
    const rows = [
      row("optional", { type: "habit", title: "Extra", tier: "optional", days: [4] }),
      row("floor", { type: "habit", title: "Floor", days: [4] }),
      row("other", { type: "habit", title: "Weekend", days: [0] }),
      row("archived", { type: "habit", title: "Old" }, "2026-10-08"),
    ];
    expect(dueHabits(rows, "2026-10-08").map((r) => r.id)).toEqual(["floor", "optional"]);
  });
  it("recognizes a configured minimum as a completed routine", () => {
    const routine = "00000000-0000-4000-8000-000000000001";
    const rows = [
      row(routine, {
        type: "routine",
        title: "Evening",
        full: ["Check plan", "Pack bag"],
        short: ["Pack bag"],
        minimum: ["Check plan"],
      }),
      row("log", {
        type: "routine_run",
        title: "Evening",
        routineId: routine,
        date: "2026-10-08",
        variant: "minimum",
        outcome: "done",
        completedSteps: ["Check plan"],
      }),
    ];
    expect(dueRoutines(rows, "2026-10-08")[0].log?.data.outcome).toBe("done");
  });
  it("keeps unknown meal measurements visible", () => {
    const rows = [
      {
        data: LifeRecord.parse({
          type: "meal",
          title: "Lunch",
          date: "2026-10-08",
          calories: 400,
          protein: 20,
        }),
      },
      { data: LifeRecord.parse({ type: "meal", title: "Dinner", date: "2026-10-08" }) },
    ];
    const meals = rows.filter(
      (r): r is { data: Extract<typeof r.data, { type: "meal" }> } => r.data.type === "meal",
    );
    expect(mealTotals(meals, "2026-10-08").protein).toEqual({ total: 20, unknown: 1 });
  });
  it("advances the split only after a completed workout", () => {
    const a = "00000000-0000-4000-8000-000000000001",
      b = "00000000-0000-4000-8000-000000000002";
    const rows = [
      row(a, { type: "workout_plan", title: "A", exercises: "Squat", position: 1 }),
      row(b, { type: "workout_plan", title: "B", exercises: "Row", position: 2 }),
      row("log", {
        type: "workout",
        title: "A",
        planId: a,
        date: "2026-10-08",
        exercises: "Squat",
        outcome: "partial",
      }),
    ];
    expect(nextWorkout(rows)?.id).toBe(a);
    rows[2].data = { ...rows[2].data, outcome: "done" } as (typeof rows)[2]["data"];
    expect(nextWorkout(rows)?.id).toBe(b);
  });
});
