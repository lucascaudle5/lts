import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LifeRecord, type WorkspaceOperation, UserBackup } from "@/contracts/life";
import type { Db } from "@/server/db/client";
import {
  profiles,
  tasks,
  scheduleBlocks,
  lifeRecords,
  changeLog,
  observations,
} from "@/server/db/schema";
import { listObservationsOn } from "@/server/repositories/observations";
import { getRecentObservationsTool } from "@/server/tools/getRecentObservations";
import { createTestDatabase, type TestDatabase } from "@/server/db/test-database";
import {
  exportUserData,
  listArchivedTasks,
  listHistory,
  listLifeRecords,
  listSchedule,
} from "@/server/repositories/life";
import { getPreferences } from "@/server/repositories/profiles";
import { listOpenTasks } from "@/server/repositories/tasks";
import { getWorkspace } from "@/server/workspace";
import { createCapture } from "@/server/captures";
import { interpretCapture } from "@/server/compiler/interpretCapture";
import { applyAllowedExplicitTask } from "@/server/compiler/explicit";
import { runMutations } from "./runMutations";

const A = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "bbbbbbbb-0000-4000-8000-00000000000b",
  TZ = "America/Chicago";
let testDb: TestDatabase;
let db: Db;
const mutate = (user: string, operations: WorkspaceOperation[]) =>
  runMutations(user, { origin: "manual", workspace: operations, timezone: TZ }, db);
const save = (user: string, data: unknown) =>
  mutate(user, [{ op: "record.save", record: LifeRecord.parse(data) }]);
beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
});
beforeEach(async () => {
  await db.delete(profiles).where(eq(profiles.userId, A));
  await db.delete(profiles).where(eq(profiles.userId, B));
  await db.insert(profiles).values([
    { userId: A, timezone: TZ },
    { userId: B, timezone: TZ },
  ]);
});
afterAll(async () => {
  await testDb?.drop();
});

describe("complete workspace", () => {
  it("pays a recurring bill once, scopes collections, and keeps both audited", async () => {
    const bill = await save(A, {
      type: "money",
      title: "Rent",
      date: "2026-10-31",
      direction: "bill",
      amount: 800,
      recurrence: "monthly",
    });
    const id = bill.applied[0].entityId;
    await expect(mutate(B, [{ op: "money.pay", id }])).rejects.toThrow("unavailable");
    await mutate(A, [{ op: "money.pay", id }]);
    await mutate(A, [{ op: "money.pay", id }]);
    const records = await listLifeRecords(A, db);
    expect(records).toHaveLength(2);
    expect(records.find((r) => r.id !== id)?.data).toMatchObject({
      date: "2026-11-30",
      paid: false,
    });
    await expect(
      mutate(B, [{ op: "record.collection", id, collection: "Hijack" }]),
    ).rejects.toThrow("unavailable");
    await mutate(A, [
      { op: "record.archive", id, archive: true },
      { op: "record.collection", id, collection: "Autumn" },
    ]);
    expect((await listLifeRecords(A, db)).find((r) => r.id === id)?.data.collection).toBe("Autumn");
    expect((await listHistory(A, db))[0].before).toBeTruthy();
  });
  it("corrects and archives observations without leaking them to another user or AI tools", async () => {
    const created = await runMutations(
      A,
      {
        origin: "manual",
        timezone: TZ,
        commands: [
          {
            command: {
              kind: "observation.record",
              payload: {
                category: "energy",
                valueText: "My original words",
                occurredOn: "2026-10-08",
              },
            },
          },
        ],
      },
      db,
    );
    const id = created.applied[0].entityId;
    await expect(
      mutate(B, [
        {
          op: "observation.save",
          id,
          category: "energy",
          valueText: "Hijack",
          occurredOn: "2026-10-08",
        },
      ]),
    ).rejects.toThrow("unavailable");
    await mutate(A, [
      {
        op: "observation.save",
        id,
        category: "energy",
        valueText: "My corrected words",
        occurredOn: "2026-10-08",
      },
    ]);
    const edit = (await listHistory(A, db))[0];
    await mutate(A, [{ op: "undo", changeId: edit.id }]);
    expect((await listObservationsOn(A, "2026-10-08", db))[0].valueText).toBe("My original words");
    await mutate(A, [{ op: "observation.archive", id, archive: true }]);
    expect(await listObservationsOn(A, "2026-10-08", db)).toEqual([]);
    await db
      .update(profiles)
      .set({ aiSensitiveCategories: ["energy"] })
      .where(eq(profiles.userId, A));
    expect(
      (await getRecentObservationsTool(A, { days: 7, categories: ["energy"] }, "2026-10-08", db))
        .observations,
    ).toEqual([]);
    const backup = UserBackup.parse(JSON.parse(JSON.stringify(await exportUserData(A, db))));
    await runMutations(B, { origin: "manual", importBackup: backup, timezone: TZ }, db);
    expect(await listObservationsOn(B, "2026-10-08", db)).toEqual([]);
    const imported = await db.select().from(observations).where(eq(observations.userId, B));
    expect(imported[0].deletedAt).toBeTruthy();
    await mutate(A, [{ op: "observation.archive", id, archive: false }]);
    expect(await listObservationsOn(A, "2026-10-08", db)).toHaveLength(1);
  });
  it("isolates every workspace repository and export", async () => {
    await save(A, { type: "habit", title: "A floor" });
    await save(B, { type: "state", title: "B private", date: "2026-10-08", mood: "B words" });
    for (const user of [A, B]) {
      await runMutations(
        user,
        {
          origin: "manual",
          timezone: TZ,
          commands: [
            {
              command: {
                kind: "task.create",
                payload: { title: `${user === A ? "A" : "B"} task`, taskKind: "other" },
              },
            },
            {
              command: {
                kind: "schedule_block.create",
                payload: {
                  title: `${user === A ? "A" : "B"} block`,
                  blockKind: "work",
                  date: "2026-10-08",
                  start: "09:00",
                  end: "10:00",
                  fixed: true,
                },
              },
            },
          ],
        },
        db,
      );
    }
    for (const read of [
      listLifeRecords,
      listSchedule,
      listArchivedTasks,
      listHistory,
      exportUserData,
    ]) {
      expect(JSON.stringify(await read(A, db))).not.toContain("B private");
      expect(JSON.stringify(await read(B, db))).not.toContain("A floor");
    }
    const a = await getWorkspace(A, TZ, db);
    expect(JSON.stringify(a)).not.toContain("B private");
    expect(a.tasks.map((t) => t.title)).toEqual(["A task"]);
    expect(a.schedule.map((t) => t.title)).toEqual(["A block"]);
    expect(await getPreferences(A, db)).toEqual({
      timezone: TZ,
      authority: "ask",
      theme: "sandstone",
    });
    expect(await getPreferences("dddddddd-0000-4000-8000-00000000000d", db)).toBeNull();
  });
  it("rejects cross-user parents, edits, archive and undo with no writes", async () => {
    const created = await save(A, { type: "habit", title: "A floor" });
    const id = created.applied[0].entityId;
    const history = await listHistory(A, db);
    await expect(
      save(B, {
        type: "habit_log",
        title: "B log",
        habitId: id,
        date: "2026-10-08",
        outcome: "done",
      }),
    ).rejects.toThrow("linked record");
    await expect(mutate(B, [{ op: "record.archive", id, archive: true }])).rejects.toThrow(
      "unavailable",
    );
    await expect(
      mutate(B, [
        { op: "record.save", id, record: LifeRecord.parse({ type: "habit", title: "Hijack" }) },
      ]),
    ).rejects.toThrow("unavailable");
    await expect(mutate(B, [{ op: "undo", changeId: history[0].id }])).rejects.toThrow(
      "cannot be undone",
    );
    expect(await listHistory(B, db)).toHaveLength(0);
    expect((await listLifeRecords(A, db))[0].data.title).toBe("A floor");
  });
  it("upserts daily habit and routine logs and validates a defined minimum", async () => {
    const habit = (await save(A, { type: "habit", title: "Read", target: 2 })).applied[0].entityId;
    await save(A, {
      type: "habit_log",
      title: "Read",
      habitId: habit,
      date: "2026-10-08",
      outcome: "done",
      value: 1,
    });
    await save(A, {
      type: "habit_log",
      title: "Read",
      habitId: habit,
      date: "2026-10-08",
      outcome: "done",
      value: 2,
    });
    const routine = (
      await save(A, {
        type: "routine",
        title: "Evening",
        full: ["Plan", "Pack"],
        short: ["Pack"],
        minimum: ["Plan"],
      })
    ).applied[0].entityId;
    await expect(
      save(A, {
        type: "routine_run",
        title: "Evening",
        routineId: routine,
        date: "2026-10-08",
        variant: "full",
        outcome: "done",
        completedSteps: ["Pack"],
      }),
    ).rejects.toThrow("Finish");
    await save(A, {
      type: "routine_run",
      title: "Evening",
      routineId: routine,
      date: "2026-10-08",
      variant: "minimum",
      outcome: "done",
      completedSteps: ["Plan"],
    });
    const rows = await listLifeRecords(A, db);
    expect(rows.filter((r) => r.data.type === "habit_log")).toHaveLength(1);
    expect(rows.find((r) => r.data.type === "routine_run")?.data).toMatchObject({
      variant: "minimum",
      outcome: "done",
    });
  });
  it("protects stale edits and preserves snapshots for undo and archive restore", async () => {
    const id = (await save(A, { type: "project", title: "First" })).applied[0].entityId;
    const first = (await listLifeRecords(A, db))[0];
    await mutate(A, [
      {
        op: "record.save",
        id,
        record: LifeRecord.parse({ type: "project", title: "Second" }),
        expectedUpdatedAt: first.updatedAt,
      },
    ]);
    await expect(
      mutate(A, [
        {
          op: "record.save",
          id,
          record: LifeRecord.parse({ type: "project", title: "Stale" }),
          expectedUpdatedAt: first.updatedAt,
        },
      ]),
    ).rejects.toThrow("changed");
    const history = await listHistory(A, db);
    await mutate(A, [{ op: "undo", changeId: history[0].id }]);
    expect((await listLifeRecords(A, db))[0].data.title).toBe("First");
    await expect(mutate(A, [{ op: "undo", changeId: history[1].id }])).rejects.toThrow(
      "later change",
    );
    await mutate(A, [{ op: "record.archive", id, archive: true }]);
    expect((await listLifeRecords(A, db))[0].archivedAt).not.toBeNull();
    await mutate(A, [{ op: "record.archive", id, archive: false }]);
    expect((await listLifeRecords(A, db))[0].archivedAt).toBeNull();
  });
  it("uses wall-clock recurrence across DST and rolls back conflicted imports", async () => {
    const block = {
      title: "Class",
      blockKind: "class" as const,
      date: "2026-10-26",
      start: "09:00",
      end: "10:00",
      fixed: true,
    };
    await mutate(A, [
      {
        op: "schedule.save",
        block,
        repeat: { until: "2026-11-09", days: [1] },
        allowOverlap: false,
      },
    ]);
    const rows = await listSchedule(A, db);
    expect(rows.map((r) => r.startsAt.toISOString()).sort()).toEqual([
      "2026-10-26T14:00:00.000Z",
      "2026-11-02T15:00:00.000Z",
      "2026-11-09T15:00:00.000Z",
    ]);
    await expect(
      mutate(A, [
        { op: "schedule.save", block: { ...block, date: "2026-10-27" }, allowOverlap: false },
        { op: "schedule.save", block, allowOverlap: false },
      ]),
    ).rejects.toThrow("overlaps");
    expect(await listSchedule(A, db)).toHaveLength(3);
    await expect(
      mutate(B, [{ op: "schedule.archive", id: rows[0].id, archive: true, series: true }]),
    ).rejects.toThrow("unavailable");
    await mutate(A, [{ op: "schedule.archive", id: rows[0].id, archive: true, series: true }]);
    expect((await listSchedule(A, db)).every((r) => r.deletedAt)).toBe(true);
  });
  it("rejects a project owned by another user and hides archived tasks from Today/tools", async () => {
    const project = (await save(A, { type: "project", title: "A project" })).applied[0].entityId;
    await expect(
      runMutations(
        B,
        {
          origin: "manual",
          timezone: TZ,
          commands: [
            {
              command: {
                kind: "task.create",
                payload: {
                  title: "B task",
                  taskKind: "other",
                  details: {
                    estimateMinutes: 0,
                    nextAction: "",
                    blocker: "",
                    projectId: project,
                    subtasks: [],
                    sessions: [],
                  },
                },
              },
            },
          ],
        },
        db,
      ),
    ).rejects.toThrow("Project");
    const result = await runMutations(
      A,
      {
        origin: "manual",
        timezone: TZ,
        commands: [
          { command: { kind: "task.create", payload: { title: "Keep", taskKind: "other" } } },
        ],
      },
      db,
    );
    const id = result.applied[0].entityId;
    await mutate(A, [{ op: "task.archive", id, archive: true }]);
    expect(await listOpenTasks(A, {}, db)).toEqual([]);
    await mutate(A, [{ op: "task.archive", id, archive: false }]);
    expect(await listOpenTasks(A, {}, db)).toHaveLength(1);
  });
  it("imports a backup atomically with new parent IDs and its own audit trail", async () => {
    const parent = (await save(A, { type: "habit", title: "Read" })).applied[0].entityId;
    await save(A, {
      type: "habit_log",
      title: "Read",
      habitId: parent,
      date: "2026-10-08",
      outcome: "done",
      value: 1,
    });
    const backup = UserBackup.parse(await exportUserData(A, db));
    await runMutations(B, { origin: "manual", importBackup: backup, timezone: TZ }, db);
    const rows = await listLifeRecords(B, db);
    const log = rows.find((r) => r.data.type === "habit_log")!;
    const habit = rows.find((r) => r.data.type === "habit")!;
    expect(log.data).toMatchObject({ habitId: habit.id });
    expect(habit.id).not.toBe(parent);
    expect(await listHistory(B, db)).toHaveLength(2);
    const missing = UserBackup.parse({
      ...backup,
      records: backup.records.filter((r) => r.data.type !== "habit"),
    });
    await expect(
      runMutations(B, { origin: "manual", importBackup: missing, timezone: TZ }, db),
    ).rejects.toThrow("missing");
    expect(await listLifeRecords(B, db)).toHaveLength(2);
  });
  it("executes only explicit task commands within the saved authority setting", async () => {
    const capture = await createCapture(
      A,
      "Add task: buy milk tomorrow",
      TZ,
      new Date("2026-10-08T12:00Z"),
      db,
    );
    await interpretCapture(A, capture.captureId, db);
    expect(await applyAllowedExplicitTask(A, capture.captureId, db)).toBe(false);
    await mutate(A, [{ op: "profile.save", timezone: TZ, authority: "allow_explicit" }]);
    expect(await applyAllowedExplicitTask(A, capture.captureId, db)).toBe(true);
    expect(await applyAllowedExplicitTask(A, capture.captureId, db)).toBe(false);
    expect((await listOpenTasks(A, {}, db))[0]).toMatchObject({
      title: "buy milk",
      dueOn: "2026-10-09",
    });
    const normal = await createCapture(A, "need groceries", TZ, new Date(), db);
    await interpretCapture(A, normal.captureId, db);
    expect(await applyAllowedExplicitTask(A, normal.captureId, db)).toBe(false);
    expect(
      await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, B))),
    ).toEqual([]);
  });
  it("records every successful room write in one mutation group", async () => {
    const result = await mutate(A, [
      {
        op: "record.save",
        record: LifeRecord.parse({ type: "food", title: "Meal", serving: "1 bowl", protein: 10 }),
      },
      {
        op: "record.save",
        record: LifeRecord.parse({
          type: "state",
          title: "Check-in",
          date: "2026-10-08",
          energy: "tired",
        }),
      },
    ]);
    const logs = await db.select().from(changeLog).where(eq(changeLog.userId, A));
    expect(logs.every((log) => log.mutationId === result.mutationId && log.actor === "user")).toBe(
      true,
    );
    expect(await db.select().from(lifeRecords).where(eq(lifeRecords.userId, A))).toHaveLength(2);
    expect(await db.select().from(scheduleBlocks).where(eq(scheduleBlocks.userId, A))).toHaveLength(
      0,
    );
  });
  it("saves the display theme through profile.save, audited and scoped to the user", async () => {
    expect((await getPreferences(A, db))?.theme).toBe("sandstone");
    const result = await mutate(A, [
      { op: "profile.save", timezone: TZ, authority: "ask", theme: "dark" },
    ]);
    expect((await getPreferences(A, db))?.theme).toBe("dark");
    expect((await getPreferences(B, db))?.theme).toBe("sandstone");
    const [log] = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.userId, A), eq(changeLog.mutationId, result.mutationId)));
    expect(log).toMatchObject({ entityType: "profile", origin: "manual", actor: "user" });
    expect((log?.before as { theme: string }).theme).toBe("sandstone");
    expect((log?.after as { theme: string }).theme).toBe("dark");

    await mutate(A, [{ op: "profile.save", timezone: "America/New_York", authority: "ask" }]);
    expect(await getPreferences(A, db)).toMatchObject({
      theme: "dark",
      timezone: "America/New_York",
    });
  });
});
