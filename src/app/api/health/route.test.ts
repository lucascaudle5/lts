import { beforeEach, describe, expect, it, vi } from "vitest";

const getHealth = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/health", () => ({ getHealth }));

const { GET } = await import("./route");

beforeEach(() => getHealth.mockReset());

describe("GET /api/health", () => {
  it("returns 200 and no-store when healthy", async () => {
    getHealth.mockResolvedValue({ status: "ok", version: "0.2.0", commit: null, db: "ok" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      version: "0.2.0",
      commit: null,
      db: "ok",
    });
  });

  it("returns 503 when the database is unreachable", async () => {
    getHealth.mockResolvedValue({ status: "degraded", version: "dev", commit: null, db: "error" });
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ db: "error" });
  });
});
