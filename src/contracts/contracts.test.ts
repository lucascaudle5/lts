import { describe, expect, it } from "vitest";

import { DomainCommand, ScheduleBlockCreate, commandPayloadSchemas } from "./commands";
import { HhMm, IsoDate, Timezone } from "./common";
import { ProposalItem, SubmitProposals, type ProposalDraft } from "./proposals";
import { GetScheduleInput, ListOpenTasksInput, toolInputSchemas } from "./tools";

const roundTrip = <T>(schema: { parse: (v: unknown) => T }, value: unknown): T =>
  schema.parse(JSON.parse(JSON.stringify(schema.parse(value))));

const commands: DomainCommand[] = [
  {
    kind: "schedule_block.create",
    payload: {
      title: "Work",
      blockKind: "work",
      date: "2026-10-10",
      start: "14:00",
      end: "19:00",
      fixed: true,
    },
  },
  { kind: "task.create", payload: { title: "Test", taskKind: "exam", dueOn: "2026-10-13" } },
  { kind: "task.create", payload: { title: "Groceries", taskKind: "errand" } },
  {
    kind: "observation.record",
    payload: { category: "energy", valueText: "exhausted lately", occurredOn: "2026-10-07" },
  },
];

describe("domain commands", () => {
  it.each(commands)("round-trips $kind", (command) => {
    expect(roundTrip(DomainCommand, command)).toEqual(command);
  });

  it("has a payload schema for every kind", () => {
    expect(Object.keys(commandPayloadSchemas).sort()).toEqual(
      ["observation.record", "schedule_block.create", "task.create"].sort(),
    );
  });

  it("defaults blocks to not fixed", () => {
    const parsed = ScheduleBlockCreate.parse({
      title: "Gym",
      blockKind: "fitness",
      date: "2026-10-07",
      start: "07:00",
      end: "08:00",
    });
    expect(parsed.fixed).toBe(false);
  });

  it("rejects unknown kinds and malformed payloads", () => {
    expect(DomainCommand.safeParse({ kind: "task.delete", payload: {} }).success).toBe(false);
    expect(
      DomainCommand.safeParse({ kind: "task.create", payload: { title: "", taskKind: "errand" } })
        .success,
    ).toBe(false);
  });
});

describe("primitives", () => {
  it.each(["2026-10-07", "2028-02-29"])("accepts date %s", (v) => {
    expect(IsoDate.safeParse(v).success).toBe(true);
  });
  it.each(["2026-02-30", "2026-13-01", "10/07/2026", "2027-02-29"])("rejects date %s", (v) => {
    expect(IsoDate.safeParse(v).success).toBe(false);
  });
  it.each(["00:00", "07:30", "23:59"])("accepts time %s", (v) => {
    expect(HhMm.safeParse(v).success).toBe(true);
  });
  it.each(["24:00", "7:30", "12:60", "2pm"])("rejects time %s", (v) => {
    expect(HhMm.safeParse(v).success).toBe(false);
  });
  it("validates IANA timezones", () => {
    expect(Timezone.safeParse("America/Chicago").success).toBe(true);
    expect(Timezone.safeParse("Mars/Olympus").success).toBe(false);
  });
});

const item: ProposalItem = {
  id: "0d9d5a8e-7b8e-4f3e-9a51-2b7f1c7e3a10",
  kind: "schedule_block.create",
  payload: { title: "Gym", blockKind: "fitness", date: "2026-10-07" },
  status: "needs_input",
  missingSlots: [
    { path: "start", reason: "When does it start?" },
    { path: "end", reason: "When does it end?" },
  ],
  warnings: [{ code: "date_is_today", message: "Wednesday = today?" }],
  provenance: { source: "parser", quote: "gym Monday Wednesday Friday", confidence: "medium" },
};

describe("proposals", () => {
  it("round-trips a partial proposal item", () => {
    expect(roundTrip(ProposalItem, item)).toEqual(item);
  });

  it("rejects invalid values even in a partial payload", () => {
    const bad = { ...item, payload: { ...item.payload, date: "saturday" } };
    expect(ProposalItem.safeParse(bad).success).toBe(false);
  });

  it("requires a quote in provenance", () => {
    const bad = { ...item, provenance: { ...item.provenance, quote: "" } };
    expect(ProposalItem.safeParse(bad).success).toBe(false);
  });

  it("caps submit_proposals at 20 items", () => {
    const draft: ProposalDraft = {
      kind: "task.create",
      payload: { title: "Groceries", taskKind: "errand" },
      quote: "need groceries",
      confidence: "high",
    };
    expect(SubmitProposals.safeParse({ items: Array(20).fill(draft) }).success).toBe(true);
    expect(SubmitProposals.safeParse({ items: Array(21).fill(draft) }).success).toBe(false);
    expect(roundTrip(SubmitProposals, { items: [draft] })).toEqual({ items: [draft] });
  });
});

describe("tool inputs", () => {
  it("limits get_schedule to a 14-day window", () => {
    expect(GetScheduleInput.safeParse({ from: "2026-10-07", to: "2026-10-20" }).success).toBe(true);
    expect(GetScheduleInput.safeParse({ from: "2026-10-07", to: "2026-10-21" }).success).toBe(
      false,
    );
    expect(GetScheduleInput.safeParse({ from: "2026-10-07", to: "2026-10-06" }).success).toBe(
      false,
    );
  });

  it("limits list_open_tasks to 50 and rejects unknown arguments", () => {
    expect(ListOpenTasksInput.parse({})).toEqual({ limit: 50 });
    expect(ListOpenTasksInput.safeParse({ limit: 51 }).success).toBe(false);
    expect(ListOpenTasksInput.safeParse({ sql: "select 1" }).success).toBe(false);
  });

  it("has an input schema for every tool", () => {
    expect(Object.keys(toolInputSchemas)).toHaveLength(5);
  });
});
