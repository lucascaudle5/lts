import { describe, expect, it } from "vitest";

import { TodayView } from "@/contracts/today";

import type { BlockRow } from "./repositories/blocks";
import { buildTodayView, type TodayInput } from "./today";

const TZ = "America/Chicago";
/** Wed 2026-10-07, 10:30 AM in Chicago (CDT, UTC-5). */
const NOW = new Date("2026-10-07T15:30:00Z");

let seq = 0;
function block(startsAt: string, endsAt: string, extra: Partial<BlockRow> = {}): BlockRow {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    title: `Block ${seq}`,
    kind: "focus",
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    fixed: false,
    ...extra,
  };
}

function build(partial: Partial<TodayInput>) {
  const view = buildTodayView({
    now: NOW,
    timezone: TZ,
    blocks: [],
    openTasks: [],
    observations: [],
    ...partial,
  });
  expect(TodayView.parse(view)).toEqual(view);
  return view;
}

describe("buildTodayView", () => {
  it("labels the day in the user's timezone", () => {
    const view = build({});
    expect(view.date).toBe("2026-10-07");
    expect(view.dateLabel).toBe("Wednesday, October 7");
    expect(view.localHour).toBe(10);
    expect(view.timezone).toBe(TZ);
  });

  it("is empty only when every section is empty", () => {
    expect(build({}).isEmpty).toBe(true);
    const task = {
      id: "00000000-0000-4000-9000-000000000000",
      title: "x",
      dueOn: null,
      priority: "medium" as const,
      status: "open" as const,
      notes: null,
    };
    expect(build({ openTasks: [{ ...task, kind: "other" }] }).isEmpty).toBe(false);
  });

  it("puts today's blocks in time order with past/now/later timing", () => {
    const later = block("2026-10-07T19:00:00Z", "2026-10-08T00:00:00Z", {
      title: "Work",
      kind: "work",
      fixed: true,
    });
    const past = block("2026-10-07T12:00:00Z", "2026-10-07T13:00:00Z", { title: "Gym" });
    const now = block("2026-10-07T15:00:00Z", "2026-10-07T16:15:00Z", { title: "Stats" });
    const view = build({ blocks: [later, past, now] });
    expect(view.blocks.map((b) => [b.title, b.timing, b.timeLabel])).toEqual([
      ["Gym", "past", "7:00 AM – 8:00 AM"],
      ["Stats", "now", "10:00 AM – 11:15 AM"],
      ["Work", "later", "2:00 PM – 7:00 PM"],
    ]);
    expect(view.blocks[2]).toMatchObject({ start: "14:00", end: "19:00", fixed: true });
  });

  it("assigns blocks to the local date, not the UTC date", () => {
    // 22:00 Chicago on Oct 7 is 03:00 UTC on Oct 8.
    const evening = block("2026-10-08T03:00:00Z", "2026-10-08T04:00:00Z", { title: "Late" });
    // 00:30 Chicago on Oct 8 belongs to tomorrow.
    const tomorrow = block("2026-10-08T05:30:00Z", "2026-10-08T06:00:00Z", { title: "Early" });
    const view = build({ blocks: [evening, tomorrow] });
    expect(view.blocks.map((b) => b.title)).toEqual(["Late"]);
    expect(view.upcoming).toEqual([
      expect.objectContaining({ date: "2026-10-08", label: "Tomorrow" }),
    ]);
  });

  it("marks blocks that end on a later day", () => {
    const overnight = block("2026-10-08T04:00:00Z", "2026-10-08T07:00:00Z");
    expect(build({ blocks: [overnight] }).blocks[0].timeLabel).toBe("11:00 PM – 2:00 AM (+1 day)");
  });

  it("groups the next 7 days by date and drops anything later", () => {
    const sat = block("2026-10-10T19:00:00Z", "2026-10-11T00:00:00Z", { title: "Sat work" });
    const sat2 = block("2026-10-10T14:00:00Z", "2026-10-10T15:00:00Z", { title: "Sat gym" });
    const lastDay = block("2026-10-14T14:00:00Z", "2026-10-14T15:00:00Z", { title: "Wed next" });
    const tooFar = block("2026-10-15T14:00:00Z", "2026-10-15T15:00:00Z", { title: "Too far" });
    const view = build({ blocks: [tooFar, sat, lastDay, sat2] });
    expect(view.upcoming.map((d) => [d.label, d.blocks.map((b) => b.title)])).toEqual([
      ["Sat, Oct 10", ["Sat gym", "Sat work"]],
      ["Wed, Oct 14", ["Wed next"]],
    ]);
    expect(view.upcoming[0].blocks.every((b) => b.timing === "later")).toBe(true);
  });

  it("labels task due dates plainly, including past ones", () => {
    const id = (n: number) => `00000000-0000-4000-9000-00000000000${n}`;
    const view = build({
      openTasks: [
        {
          id: id(1),
          title: "Was due",
          kind: "assignment",
          dueOn: "2026-10-05",
          priority: "high",
          status: "open",
          notes: null,
        },
        {
          id: id(2),
          title: "Today",
          kind: "chore",
          dueOn: "2026-10-07",
          priority: "medium",
          status: "open",
          notes: null,
        },
        {
          id: id(3),
          title: "Exam",
          kind: "exam",
          dueOn: "2026-10-13",
          priority: "high",
          status: "open",
          notes: null,
        },
        {
          id: id(4),
          title: "Groceries",
          kind: "errand",
          dueOn: null,
          priority: "low",
          status: "open",
          notes: null,
        },
      ],
    });
    expect(
      view.openTasks.map((t) => [t.title, t.dueLabel, t.dueToday, t.pastDue, t.taskKind]),
    ).toEqual([
      ["Was due", "Waiting since Mon, Oct 5", false, true, "assignment"],
      ["Today", "Due today", true, false, "chore"],
      ["Exam", "Due Tue, Oct 13", false, false, "exam"],
      ["Groceries", null, false, false, "errand"],
    ]);
  });

  it("shows only today's observations, in the user's words", () => {
    const view = build({
      observations: [
        {
          id: "00000000-0000-4000-a000-000000000001",
          category: "sleep",
          valueText: "slept about 6 hours",
          occurredOn: "2026-10-06",
        },
        {
          id: "00000000-0000-4000-a000-000000000002",
          category: "energy",
          valueText: "pretty tired after lab",
          occurredOn: "2026-10-07",
        },
      ],
    });
    expect(view.observations).toEqual([
      {
        id: "00000000-0000-4000-a000-000000000002",
        category: "energy",
        valueText: "pretty tired after lab",
        provenance: null,
      },
    ]);
  });
});
