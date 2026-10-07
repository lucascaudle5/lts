import { afterEach, describe, expect, it, vi } from "vitest";

import { DB_PING_TIMEOUT_MS, getHealth } from "./health";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("getHealth", () => {
  it("reports ok with version and short commit when the database answers", async () => {
    vi.stubEnv("LTS_VERSION", "0.2.0");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abcdef1234567890");
    await expect(getHealth(async () => {})).resolves.toEqual({
      status: "ok",
      version: "0.2.0",
      commit: "abcdef1",
      db: "ok",
    });
  });

  it("reports degraded without leaking the error", async () => {
    const health = await getHealth(async () => {
      throw new Error("password authentication failed for user postgres");
    });
    expect(health).toMatchObject({ status: "degraded", db: "error" });
    expect(JSON.stringify(health)).not.toContain("password");
  });

  it("gives up on a hanging database", async () => {
    vi.useFakeTimers();
    const pending = getHealth(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(DB_PING_TIMEOUT_MS);
    await expect(pending).resolves.toMatchObject({ db: "error" });
  });
});
