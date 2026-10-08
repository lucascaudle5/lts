import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { createTestDatabase, type TestDatabase } from "@/server/db/test-database";

const mocks = vi.hoisted(() => ({
  db: null as Db | null,
  sub: null as string | null,
}));

vi.mock("@/server/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db/client")>()),
  getDb: () => mocks.db,
}));
vi.mock("@/server/supabase", () => ({
  createRequestAuthClient: async () => ({
    auth: {
      getClaims: async () => ({
        data: mocks.sub ? { claims: { sub: mocks.sub, email: "sam@example.com" } } : null,
        error: null,
      }),
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));

const { ensureProfile, requireUser } = await import("./auth");

const NEW_USER = "eeeeeeee-0000-4000-8000-00000000000e";
const RETURNING = "ffffffff-0000-4000-8000-00000000000f";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
  mocks.db = testDb.db;
});

afterAll(async () => {
  await testDb?.drop();
});

beforeEach(() => {
  mocks.sub = null;
});

async function timezoneOf(userId: string) {
  const [row] = await testDb.db
    .select({ timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  return row?.timezone;
}

describe("profile bootstrap", () => {
  it("creates the profile once and never overwrites its timezone", async () => {
    await expect(ensureProfile(RETURNING, "America/Chicago")).resolves.toEqual({
      userId: RETURNING,
      timezone: "America/Chicago",
    });
    await expect(ensureProfile(RETURNING, "Europe/Berlin")).resolves.toEqual({
      userId: RETURNING,
      timezone: "America/Chicago",
    });
  });

  it("stores UTC when the timezone is not a real IANA zone", async () => {
    const userId = "12121212-0000-4000-8000-000000000012";
    await ensureProfile(userId, "Nowhere/Land");
    expect(await timezoneOf(userId)).toBe("UTC");
  });

  it("first sign-in stores the browser timezone", async () => {
    await ensureProfile(NEW_USER, "America/Chicago");
    expect(await timezoneOf(NEW_USER)).toBe("America/Chicago");
  });
});

describe("requireUser", () => {
  it("returns the session user with their profile timezone", async () => {
    mocks.sub = RETURNING;
    await expect(requireUser()).resolves.toEqual({
      userId: RETURNING,
      email: "sam@example.com",
      timezone: "America/Chicago",
    });
  });

  it("bootstraps a missing profile instead of failing", async () => {
    const userId = "34343434-0000-4000-8000-000000000034";
    mocks.sub = userId;
    await expect(requireUser()).resolves.toMatchObject({ userId, timezone: "UTC" });
    expect(await timezoneOf(userId)).toBe("UTC");
  });

  it("redirects without a session", async () => {
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT /sign-in");
  });
});
