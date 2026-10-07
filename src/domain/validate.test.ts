import { describe, expect, it } from "vitest";

import type { ProposalDraft } from "@/contracts/proposals";

import { findDuplicateTasks, findFixedBlockConflicts, type ExistingBlock } from "./conflicts";
import { computeMissingSlots, mergeSlots, statusFromSlots } from "./slots";
import { assessDraft } from "./validate";

const REF = "2026-10-07";

const work: ExistingBlock = {
  id: "b1",
  title: "Work",
  date: "2026-10-10",
  start: "14:00",
  end: "19:00",
  fixed: true,
};

describe("computeMissingSlots", () => {
  it.each([
    ["schedule_block.create", {}, ["title", "blockKind", "date", "start", "end"]],
    [
      "schedule_block.create",
      { title: "Gym", blockKind: "fitness", date: "2026-10-07" },
      ["start", "end"],
    ],
    [
      "schedule_block.create",
      { title: "Work", blockKind: "work", date: REF, start: "14:00", end: "19:00" },
      [],
    ],
    ["task.create", { title: "Groceries" }, ["taskKind"]],
    ["task.create", { title: "  ", taskKind: "errand" }, ["title"]],
    ["task.create", { title: "Groceries", taskKind: "errand" }, []],
    ["observation.record", { category: "energy" }, ["valueText", "occurredOn"]],
  ] as const)("%s %j → %j", (kind, payload, paths) => {
    expect(computeMissingSlots(kind, payload).map((s) => s.path)).toEqual(paths);
  });

  it("offers the enum values as options", () => {
    const [slot] = computeMissingSlots("task.create", { title: "Test" });
    expect(slot.options).toEqual(["errand", "assignment", "exam", "chore", "other"]);
  });

  it("derives status from slots", () => {
    expect(statusFromSlots([])).toBe("ready");
    expect(statusFromSlots([{ path: "start", reason: "?" }])).toBe("needs_input");
  });

  it("keeps the first slot per path", () => {
    const merged = mergeSlots([{ path: "end", reason: "a" }], [{ path: "end", reason: "b" }]);
    expect(merged).toEqual([{ path: "end", reason: "a" }]);
  });
});

describe("conflicts", () => {
  it.each([
    ["13:00", "15:00", true],
    ["15:00", "16:00", true],
    ["18:30", "20:00", true],
    ["12:00", "14:00", false],
    ["19:00", "20:00", false],
  ])("%s–%s overlaps Work 14–19: %s", (start, end, overlaps) => {
    expect(findFixedBlockConflicts({ date: "2026-10-10", start, end }, [work])).toHaveLength(
      overlaps ? 1 : 0,
    );
  });

  it("ignores flexible blocks and other days", () => {
    const flexible = { ...work, fixed: false };
    const otherDay = { ...work, date: "2026-10-11" };
    expect(
      findFixedBlockConflicts({ date: "2026-10-10", start: "15:00", end: "16:00" }, [
        flexible,
        otherDay,
      ]),
    ).toEqual([]);
  });

  it.each([
    ["Groceries", true],
    ["groceries!", true],
    ["buy groceries", true],
    ["Get  Groceries", true],
    ["Grocery list", false],
    ["Laundry", false],
  ])("%s duplicates open 'Groceries': %s", (title, dup) => {
    expect(findDuplicateTasks(title, [{ id: "t1", title: "Groceries" }])).toHaveLength(dup ? 1 : 0);
  });
});

const block = (payload: Extract<ProposalDraft, { kind: "schedule_block.create" }>["payload"]) =>
  ({
    kind: "schedule_block.create",
    payload,
    quote: "x",
    confidence: "high",
  }) satisfies ProposalDraft;

describe("assessDraft", () => {
  it("is ready when every slot is filled and the times make sense", () => {
    const result = assessDraft(
      block({ title: "Work", blockKind: "work", date: "2026-10-10", start: "14:00", end: "19:00" }),
      { referenceDate: REF },
    );
    expect(result).toEqual({ status: "ready", missingSlots: [], warnings: [] });
  });

  it("turns end <= start into an end slot", () => {
    const result = assessDraft(
      block({ title: "Gym", blockKind: "fitness", date: REF, start: "20:00", end: "19:00" }),
      { referenceDate: REF },
    );
    expect(result.status).toBe("needs_input");
    expect(result.missingSlots.map((s) => s.path)).toEqual(["end"]);
  });

  it("warns on overlap with a fixed block without blocking", () => {
    const result = assessDraft(
      block({
        title: "Gym",
        blockKind: "fitness",
        date: "2026-10-10",
        start: "15:00",
        end: "16:00",
      }),
      { referenceDate: REF, existingBlocks: [work] },
    );
    expect(result.status).toBe("ready");
    expect(result.warnings).toEqual([
      { code: "conflicts_with_fixed_block", message: 'Overlaps "Work" (2:00 PM–7:00 PM)' },
    ]);
  });

  it("flags dates far from the reference date", () => {
    const result = assessDraft(
      block({ title: "Work", blockKind: "work", date: "2030-01-01", start: "09:00", end: "10:00" }),
      { referenceDate: REF },
    );
    expect(result.missingSlots.map((s) => s.path)).toEqual(["date"]);
  });

  it("warns about a possible duplicate task", () => {
    const result = assessDraft(
      {
        kind: "task.create",
        payload: { title: "groceries", taskKind: "errand" },
        quote: "need groceries",
        confidence: "high",
      },
      { referenceDate: REF, openTasks: [{ id: "t1", title: "Groceries" }] },
    );
    expect(result.status).toBe("ready");
    expect(result.warnings.map((w) => w.code)).toEqual(["possible_duplicate_task"]);
  });

  it("refuses observations dated in the future and warns on low confidence", () => {
    const result = assessDraft(
      {
        kind: "observation.record",
        payload: { category: "energy", valueText: "tired", occurredOn: "2026-10-08" },
        quote: "tired",
        confidence: "low",
      },
      { referenceDate: REF },
    );
    expect(result.missingSlots.map((s) => s.path)).toEqual(["occurredOn"]);
    expect(result.warnings.map((w) => w.code)).toEqual(["low_confidence"]);
  });
});
