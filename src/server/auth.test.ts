import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: null as null | {
    auth: Record<string, ReturnType<typeof vi.fn>>;
  },
}));

vi.mock("@/server/supabase", () => ({
  createRequestAuthClient: async () => mocks.client,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));
vi.mock("@/server/db/client", () => ({
  getDb: () => {
    throw new Error("unit tests must not touch the database");
  },
}));

const { getSessionUser, requireUser, resolveTimezone, signInWithPassword } = await import("./auth");

const USER_ID = "5a5a5a5a-0000-4000-8000-0000000000aa";

function fakeAuth(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  mocks.client = {
    auth: {
      getClaims: vi.fn(async () => ({ data: null, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
      ...overrides,
    },
  };
  return mocks.client.auth;
}

beforeEach(() => {
  mocks.client = null;
  vi.unstubAllEnvs();
});

describe("getSessionUser / requireUser", () => {
  it("is null without Supabase config or without a session", async () => {
    await expect(getSessionUser()).resolves.toBeNull();
    fakeAuth();
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("ignores claims whose subject is not a user id", async () => {
    fakeAuth({
      getClaims: vi.fn(async () => ({ data: { claims: { sub: "anon" } }, error: null })),
    });
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("returns the verified user", async () => {
    fakeAuth({
      getClaims: vi.fn(async () => ({
        data: { claims: { sub: USER_ID, email: "sam@example.com" } },
        error: null,
      })),
    });
    await expect(getSessionUser()).resolves.toEqual({ userId: USER_ID, email: "sam@example.com" });
  });

  it("redirects signed-out users to sign-in before touching the database", async () => {
    fakeAuth();
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT /sign-in");
  });
});

describe("resolveTimezone", () => {
  it.each([
    ["America/Chicago", "America/Chicago"],
    ["Europe/Berlin", "Europe/Berlin"],
    ["Not/AZone", "UTC"],
    ["", "UTC"],
    [undefined, "UTC"],
  ])("%s → %s", (input, expected) => {
    expect(resolveTimezone(input)).toBe(expected);
  });
});

describe("signInWithPassword", () => {
  it("is not_configured without Supabase", async () => {
    await expect(
      signInWithPassword({ email: "sam@example.com", password: "secret" }),
    ).resolves.toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("uses the submitted email and password", async () => {
    const signIn = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { code: "invalid_credentials" },
    }));
    const auth = fakeAuth();
    auth.signInWithPassword = signIn;
    await expect(
      signInWithPassword({ email: "sam@example.com", password: "wrong" }),
    ).resolves.toEqual({ ok: false, reason: "invalid_credentials" });
    expect(signIn).toHaveBeenCalledWith({ email: "sam@example.com", password: "wrong" });
  });

  it("does not reveal whether an email account exists", async () => {
    fakeAuth({
      signInWithPassword: vi.fn(async () => ({
        data: { user: null, session: null },
        error: { code: "invalid_credentials" },
      })),
    });
    await expect(
      signInWithPassword({ email: "unknown@example.com", password: "wrong" }),
    ).resolves.toEqual({ ok: false, reason: "invalid_credentials" });
  });
});
