import { describe, expect, it } from "vitest";

import { parseCapture } from "./parseCapture";

const REFERENCE_DATE = "2026-10-07" as const;

describe("parseCapture", () => {
  it("turns an appointment and an errand into drafts without writing domain data", () => {
    expect(parseCapture("dentist friday 3-4pm, need groceries", REFERENCE_DATE)).toEqual([
      {
        kind: "schedule_block.create",
        quote: "dentist friday 3-4pm",
        confidence: "high",
        payload: {
          title: "Dentist",
          blockKind: "personal",
          date: "2026-10-09",
          start: "15:00",
          end: "16:00",
          fixed: true,
        },
      },
      {
        kind: "task.create",
        quote: "need groceries",
        confidence: "medium",
        payload: { title: "Groceries", taskKind: "errand" },
      },
    ]);
  });

  it("leaves unknown appointment times as slots and expands weekday lists", () => {
    const items = parseCapture("gym Monday Wednesday Friday", REFERENCE_DATE);
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.kind)).toEqual([
      "schedule_block.create",
      "schedule_block.create",
      "schedule_block.create",
    ]);
    for (const item of items) {
      expect(item.kind).toBe("schedule_block.create");
      if (item.kind === "schedule_block.create") {
        expect(item.payload).toMatchObject({ title: "Gym", blockKind: "fitness" });
        expect(item.payload.start).toBeUndefined();
        expect(item.payload.end).toBeUndefined();
      }
    }
  });

  it("keeps observation text in the user's words", () => {
    expect(parseCapture("I've been exhausted lately", REFERENCE_DATE)).toEqual([
      {
        kind: "observation.record",
        quote: "I've been exhausted lately",
        confidence: "medium",
        payload: {
          category: "energy",
          valueText: "I've been exhausted lately",
          occurredOn: "2026-10-07",
        },
      },
    ]);
  });

  it("parses the slice example into proposals without applying them", () => {
    const items = parseCapture(
      "Work Saturday 2–7, test Tuesday, gym Monday Wednesday Friday, need groceries, and I've been exhausted lately.",
      REFERENCE_DATE,
    );
    expect(items).toHaveLength(7);
    expect(items[0]).toMatchObject({
      kind: "schedule_block.create",
      payload: { title: "Work", date: "2026-10-10", start: "14:00", end: "19:00", fixed: true },
    });
    expect(items[1]).toMatchObject({
      kind: "task.create",
      payload: { title: "Test", taskKind: "exam", dueOn: "2026-10-13" },
    });
    expect(items.slice(2, 5).map((item) => item.kind)).toEqual([
      "schedule_block.create",
      "schedule_block.create",
      "schedule_block.create",
    ]);
    expect(items[5]).toMatchObject({
      kind: "task.create",
      payload: { title: "Groceries", taskKind: "errand" },
    });
    expect(items[6]).toMatchObject({
      kind: "observation.record",
      payload: { valueText: "I've been exhausted lately", category: "energy" },
    });
  });
});
