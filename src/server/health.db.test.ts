import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "@/server/db/test-database";

import { getHealth, pingDatabase } from "./health";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
});

afterAll(async () => {
  await testDb?.drop();
});

describe("health against Postgres", () => {
  it("reports db ok when the database answers", async () => {
    await expect(getHealth(() => pingDatabase(testDb.db))).resolves.toMatchObject({
      status: "ok",
      db: "ok",
    });
  });
});
