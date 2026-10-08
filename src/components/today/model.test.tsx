import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LifeRecord, WorkspaceData } from "@/contracts/life";
import type { TodayBlock, TodayView } from "@/contracts/today";

import { Greeting } from "./Greeting";
import { buildTodayModel, daypartOf, isHeavyDay } from "./model";
import { TodayPanels } from "./TodayPanels";
import { UpNext } from "./UpNext";

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function block(n: number, start: string, end: string, extra: Partial<TodayBlock> = {}): TodayBlock {
  return {
    id: UUID(n),
    title: `Block ${n}`,
    blockKind: "work",
    date: "2026-10-08",
    start,
    end,
    timeLabel: `${start} – ${end}`,
    fixed: false,
    timing: "later",
    provenance: null,
    ...extra,
  };
}

function view(extra: Partial<TodayView> = {}): TodayView {
  return {
    date: "2026-10-08",
    timezone: "America/Chicago",
    dateLabel: "Thursday, October 8",
    localHour: 9,
    blocks: [],
    upcoming: [],
    openTasks: [],
    observations: [],
    isEmpty: true,
    ...extra,
  };
}

function row(n: number, data: Record<string, unknown>) {
  return {
    id: UUID(n),
    data: { notes: "", ...data } as unknown as LifeRecord,
    archivedAt: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };
}

function workspace(records: WorkspaceData["records"] = []): WorkspaceData {
  return {
    today: "2026-10-08",
    timezone: "America/Chicago",
    authority: "ask",
    records,
    schedule: [],
    tasks: [],
    history: [],
    observations: [],
    captures: [],
  };
}

const floorHabit = (n: number, title: string) =>
  row(n, {
    type: "habit",
    title,
    tier: "floor",
    unit: "check",
    target: 1,
    days: [0, 1, 2, 3, 4, 5, 6],
    anchor: "after coffee",
  });
const habitDone = (n: number, habitId: string) =>
  row(n, {
    type: "habit_log",
    title: "log",
    habitId,
    date: "2026-10-08",
    outcome: "done",
    value: 1,
  });

describe("Today model", () => {
  it("picks the greeting from the hour in the user's timezone", () => {
    expect([5, 11, 12, 16, 17, 23].map(daypartOf)).toEqual([
      "morning",
      "morning",
      "afternoon",
      "afternoon",
      "evening",
      "evening",
    ]);
    expect(buildTodayModel(view({ localHour: 9 }), workspace()).greeting).toBe("Good morning.");
  });

  it("calls an empty day a clear day, with no scoreboard", () => {
    const model = buildTodayModel(view(), workspace());
    expect(model.load).toBe("empty");
    expect(model.note).toBe("A clear day. Tell me what's on it, or leave it open.");
    expect(model.floor).toEqual([]);
  });

  it("shows the next block, the floor as a list, and no ratio, on an ordinary day", () => {
    const habit = floorHabit(1, "Water");
    const model = buildTodayModel(
      view({
        isEmpty: false,
        blocks: [
          block(10, "08:00", "09:00", { timing: "past" }),
          block(11, "10:00", "11:00", { timing: "now" }),
          block(12, "13:00", "14:00"),
        ],
      }),
      workspace([habit, floorHabit(2, "Stretch"), habitDone(3, habit.id)]),
    );
    expect(model.load).toBe("open");
    expect(model.upNext).toMatchObject({ now: true, block: { id: UUID(11) } });
    expect(model.earlier.map((b) => b.id)).toEqual([UUID(10)]);
    expect(model.laterToday.map((b) => b.id)).toEqual([UUID(12)]);
    expect(model.floor.map((f) => [f.title, f.done])).toEqual([
      ["Water", true],
      ["Stretch", false],
    ]);
    expect(model.note).toBe("1 small thing on your floor today.");
    expect(model.note).not.toMatch(/\d+\s*\/\s*\d+/);
  });

  it("goes gentle on a full day and decides from the calendar only", () => {
    const many = [1, 2, 3, 4, 5].map((n) => block(20 + n, `0${n}:00`, `0${n}:30`));
    expect(isHeavyDay(many)).toBe(true);
    expect(isHeavyDay([block(1, "09:00", "10:00")])).toBe(false);
    expect(
      isHeavyDay([block(1, "08:00", "12:00"), block(2, "13:00", "17:00", { fixed: true })]),
    ).toBe(true);
    const model = buildTodayModel(view({ isEmpty: false, blocks: many }), workspace());
    expect(model.load).toBe("heavy");
    expect(model.note).toBe("Today looks full. Here's the floor if you want it.");
  });

  it("never lets how the person feels switch the mode", () => {
    const sad = view({
      isEmpty: false,
      blocks: [block(1, "09:00", "10:00")],
      observations: [
        {
          id: UUID(50),
          category: "capacity",
          valueText: "completely drained, nothing left",
          provenance: null,
        },
      ],
    });
    expect(buildTodayModel(sad, workspace()).load).toBe("open");
  });

  it("closes a finished day with tomorrow's first block", () => {
    const model = buildTodayModel(
      view({
        isEmpty: false,
        localHour: 20,
        blocks: [block(1, "09:00", "10:00", { timing: "past" })],
        upcoming: [
          {
            date: "2026-10-09",
            label: "Tomorrow",
            blocks: [block(2, "08:30", "09:30", { title: "Standup", date: "2026-10-09" })],
          },
        ],
      }),
      workspace(),
    );
    expect(model.load).toBe("done");
    expect(model.greeting).toBe("That's the day.");
    expect(model.note).toBe("Tomorrow starts with Standup at 08:30.");
    expect(model.upNext).toBeNull();
  });

  it("does not call the morning done just because the floor is logged", () => {
    const habit = floorHabit(1, "Water");
    const model = buildTodayModel(
      view({ isEmpty: false, localHour: 8 }),
      workspace([habit, habitDone(2, habit.id)]),
    );
    expect(model.load).toBe("open");
    expect(model.note).toBe("Your floor is covered.");
  });
});

describe("Today markup", () => {
  it("marks the block that is happening now and keeps links reachable", () => {
    const model = buildTodayModel(
      view({
        isEmpty: false,
        blocks: [
          block(1, "10:00", "11:00", {
            timing: "now",
            title: "Deep work",
            provenance: { captureId: UUID(99), referenceDate: "2026-10-07" },
          }),
        ],
      }),
      workspace(),
    );
    const html = renderToStaticMarkup(<UpNext model={model} />);
    expect(html).toContain("Now");
    expect(html).toContain("Deep work");
    expect(html).toContain("bg-gold");
    expect(html).toContain(`/captures/${UUID(99)}`);
  });

  it("uses the quiet tint instead of gold for a full day", () => {
    const blocks = [1, 2, 3, 4, 5].map((n) =>
      block(n, `0${n}:00`, `0${n}:30`, n === 1 ? { timing: "now" } : {}),
    );
    const model = buildTodayModel(view({ isEmpty: false, blocks }), workspace());
    const html = renderToStaticMarkup(<UpNext model={model} />);
    expect(html).not.toContain("bg-gold ");
    expect(html).toContain("bg-room-soft");
  });

  it("renders the greeting and, for a past due task, waiting copy rather than overdue", () => {
    const model = buildTodayModel(view(), workspace());
    expect(
      renderToStaticMarkup(
        <Greeting model={model} dateLabel="Thursday, October 8" timezone="UTC" />,
      ),
    ).toContain("Good morning.");
    const html = renderToStaticMarkup(
      <TodayPanels
        data={workspace()}
        view={view({
          isEmpty: false,
          openTasks: [
            {
              id: UUID(60),
              title: "Call landlord",
              taskKind: "errand",
              priority: "medium",
              dueOn: "2026-10-05",
              dueLabel: "Waiting since Mon, Oct 5",
              dueToday: false,
              pastDue: true,
              provenance: null,
            },
          ],
        })}
      />,
    );
    expect(html).toContain("Waiting since Mon, Oct 5");
    expect(html).toContain("bg-quiet-soft");
    expect(html).not.toMatch(/overdue|red-|destructive/i);
  });
});

describe("guardrails", () => {
  const dir = fileURLToPath(new URL("./", import.meta.url));
  const sources = readdirSync(dir)
    .filter((f) => /\.(tsx?)$/.test(f) && !f.includes(".test."))
    .map((f) => [f, readFileSync(dir + f, "utf8")] as const);

  it.each(sources)("%s has no streaks, scores, points or miss badges", (_file, text) => {
    expect(text).not.toMatch(/\bstreak|\bpoints?\b|\bscore|you missed|overdue|\bfailed\b/i);
    expect(text).not.toMatch(/\b(?:bg|text|border)-(?:red|rose)-/);
  });
});
