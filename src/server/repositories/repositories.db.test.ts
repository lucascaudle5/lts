import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Db } from "@/server/db/client";
import { observations, profiles, scheduleBlocks, tasks } from "@/server/db/schema";
import { createTestDatabase, type TestDatabase } from "@/server/db/test-database";
import { getToday } from "@/server/today";

import { listBlocksStartingBetween } from "./blocks";
import { listObservationsOn } from "./observations";
import { getProfile } from "./profiles";
import { listOpenTasks } from "./tasks";

const A = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "bbbbbbbb-0000-4000-8000-00000000000b";
const EMPTY = "cccccccc-0000-4000-8000-00000000000c";
const TZ = "America/Chicago";
const NOW = new Date("2026-10-07T15:30:00Z");
const DAY = { from: new Date("2026-10-07T05:00:00Z"), to: new Date("2026-10-15T05:00:00Z") };

let testDb: TestDatabase;
let db: Db;

/** Gives each user the same shape of data so a missing `user_id` filter shows up as extra rows. */
async function seedUser(userId: string, label: string) {
  await db.insert(profiles).values({ userId, timezone: TZ });
  await db.insert(scheduleBlocks).values([
    {
      userId,
      title: `${label} work`,
      kind: "work",
      startsAt: new Date("2026-10-07T19:00:00Z"),
      endsAt: new Date("2026-10-08T00:00:00Z"),
      fixed: true,
      origin: "manual",
    },
    {
      userId,
      title: `${label} gym`,
      kind: "fitness",
      startsAt: new Date("2026-10-07T12:00:00Z"),
      endsAt: new Date("2026-10-07T13:00:00Z"),
      origin: "manual",
    },
    {
      userId,
      title: `${label} deleted`,
      kind: "focus",
      startsAt: new Date("2026-10-07T14:00:00Z"),
      endsAt: new Date("2026-10-07T15:00:00Z"),
      origin: "manual",
      deletedAt: new Date("2026-10-06T00:00:00Z"),
    },
    {
      userId,
      title: `${label} saturday`,
      kind: "work",
      startsAt: new Date("2026-10-10T19:00:00Z"),
      endsAt: new Date("2026-10-11T00:00:00Z"),
      origin: "manual",
    },
    {
      userId,
      title: `${label} next month`,
      kind: "class",
      startsAt: new Date("2026-11-02T15:00:00Z"),
      endsAt: new Date("2026-11-02T16:00:00Z"),
      origin: "manual",
    },
  ]);
  await db.insert(tasks).values([
    { userId, title: `${label} groceries`, kind: "errand", origin: "manual" },
    { userId, title: `${label} exam`, kind: "exam", dueOn: "2026-10-13", origin: "manual" },
    { userId, title: `${label} essay`, kind: "assignment", dueOn: "2026-10-08", origin: "manual" },
    { userId, title: `${label} laundry`, kind: "chore", status: "done", origin: "manual" },
    { userId, title: `${label} parked`, kind: "other", status: "parked", origin: "manual" },
  ]);
  await db.insert(observations).values([
    {
      userId,
      category: "energy",
      valueText: `${label} tired`,
      occurredOn: "2026-10-07",
      source: "manual_entry",
      quote: `${label} tired`,
      origin: "manual",
    },
    {
      userId,
      category: "sleep",
      valueText: `${label} slept 6h`,
      valueNum: 6,
      occurredOn: "2026-10-06",
      source: "manual_entry",
      quote: `${label} slept 6h`,
      origin: "manual",
    },
  ]);
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  await seedUser(A, "A");
  await seedUser(B, "B");
  await db.insert(profiles).values({ userId: EMPTY, timezone: "UTC" });
});

afterAll(async () => {
  await testDb?.drop();
});

describe("listBlocksStartingBetween", () => {
  it("returns only the user's live blocks in the window, earliest first", async () => {
    const rows = await listBlocksStartingBetween(A, DAY, db);
    expect(rows.map((r) => r.title)).toEqual(["A gym", "A work", "A saturday"]);
    expect(rows[1]).toMatchObject({ kind: "work", fixed: true });
  });

  it("treats the window as [from, to)", async () => {
    const at = new Date("2026-10-07T19:00:00Z");
    const startsExactly = await listBlocksStartingBetween(A, { from: at, to: DAY.to }, db);
    expect(startsExactly[0].title).toBe("A work");
    const endsExactly = await listBlocksStartingBetween(A, { from: DAY.from, to: at }, db);
    expect(endsExactly.map((r) => r.title)).toEqual(["A gym"]);
  });

  it("isolates users", async () => {
    const b = await listBlocksStartingBetween(B, DAY, db);
    expect(b.map((r) => r.title)).toEqual(["B gym", "B work", "B saturday"]);
    await expect(listBlocksStartingBetween(EMPTY, DAY, db)).resolves.toEqual([]);
  });
});

describe("listOpenTasks", () => {
  it("returns the user's open tasks, soonest due first and undated last", async () => {
    const rows = await listOpenTasks(A, {}, db);
    expect(rows.map((r) => [r.title, r.dueOn])).toEqual([
      ["A essay", "2026-10-08"],
      ["A exam", "2026-10-13"],
      ["A groceries", null],
    ]);
  });

  it("respects the limit", async () => {
    await expect(listOpenTasks(A, { limit: 1 }, db)).resolves.toHaveLength(1);
  });

  it("isolates users", async () => {
    const b = await listOpenTasks(B, {}, db);
    expect(b.every((r) => r.title.startsWith("B "))).toBe(true);
    expect(b).toHaveLength(3);
    await expect(listOpenTasks(EMPTY, {}, db)).resolves.toEqual([]);
  });
});

describe("listObservationsOn", () => {
  it("returns the user's observations for that date only", async () => {
    const rows = await listObservationsOn(A, "2026-10-07", db);
    expect(rows.map((r) => [r.category, r.valueText])).toEqual([["energy", "A tired"]]);
  });

  it("isolates users", async () => {
    const b = await listObservationsOn(B, "2026-10-06", db);
    expect(b.map((r) => r.valueText)).toEqual(["B slept 6h"]);
    await expect(listObservationsOn(EMPTY, "2026-10-07", db)).resolves.toEqual([]);
  });
});

describe("getProfile", () => {
  it("returns only the requested user's profile", async () => {
    await expect(getProfile(A, db)).resolves.toEqual({ userId: A, timezone: TZ });
    await expect(getProfile(EMPTY, db)).resolves.toEqual({ userId: EMPTY, timezone: "UTC" });
    await expect(getProfile("dddddddd-0000-4000-8000-00000000000d", db)).resolves.toBeNull();
  });
});

describe("getToday", () => {
  it("builds A's day from A's rows only", async () => {
    const view = await getToday(A, TZ, NOW, db);
    const text = JSON.stringify(view);
    expect(text).not.toContain('"B ');
    expect(view.blocks.map((b) => b.title)).toEqual(["A gym", "A work"]);
    expect(view.upcoming.map((d) => [d.date, d.blocks.map((b) => b.title)])).toEqual([
      ["2026-10-10", ["A saturday"]],
    ]);
    expect(view.openTasks.map((t) => t.title)).toEqual(["A essay", "A exam", "A groceries"]);
    expect(view.observations.map((o) => o.valueText)).toEqual(["A tired"]);
  });

  it("shows user B nothing of user A", async () => {
    const view = await getToday(B, TZ, NOW, db);
    expect(JSON.stringify(view)).not.toContain('"A ');
  });

  it("is empty for a user without rows", async () => {
    const view = await getToday(EMPTY, "UTC", NOW, db);
    expect(view.isEmpty).toBe(true);
  });
});
