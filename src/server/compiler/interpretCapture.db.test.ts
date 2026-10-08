import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { MockProvider } from "@/ai/providers/mock";
import type { Db } from "@/server/db/client";
import { harnessRuns, profiles, proposalItems, tasks } from "@/server/db/schema";
import { createTestDatabase, type TestDatabase } from "@/server/db/test-database";
import { createCapture } from "@/server/captures";

import { interpretCapture } from "./interpretCapture";

const USER = "aaaaaaaa-0000-4000-8000-00000000000a";
const TIMEZONE = "America/Chicago";
const NOW = new Date("2026-10-07T15:30:00Z");

let testDb: TestDatabase;
let db: Db;

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  await db.insert(profiles).values({ userId: USER, timezone: TIMEZONE });
});

afterAll(async () => {
  await testDb?.drop();
});

describe("interpretCapture M4 trace and fallback", () => {
  it("logs a provider failure and stores parser proposals without domain writes", async () => {
    const capture = await createCapture(USER, "need groceries", TIMEZONE, NOW, db);
    const provider = new MockProvider([new Error("scripted provider failure")]);

    const result = await interpretCapture(USER, capture.captureId, db, provider);
    const [run] = await db
      .select()
      .from(harnessRuns)
      .where(eq(harnessRuns.captureId, capture.captureId));
    const proposals = await db
      .select()
      .from(proposalItems)
      .where(eq(proposalItems.captureId, capture.captureId));
    const domainTasks = await db.select().from(tasks).where(eq(tasks.userId, USER));

    expect(result).toMatchObject({ items: 1, safetyStop: false });
    expect(run).toMatchObject({ provider: "mock", status: "fell_back" });
    expect(run.validationErrorCodes[0]).toMatch(/^provider_error:/);
    expect(proposals[0]).toMatchObject({ source: "parser", payload: { title: "Groceries" } });
    expect(domainTasks).toEqual([]);
  });
});
