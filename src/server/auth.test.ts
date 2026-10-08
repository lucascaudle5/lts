import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: null as null | {
    auth: Record<string, ReturnType<typeof vi.fn>>;
  },
  headers: new Map<string, string>(),
}));

vi.mock("@/server/supabase", () => ({
  createRequestAuthClient: async () => mocks.client,
}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => mocks.headers.get(name) ?? null }),
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

const { completeSignIn, getSessionUser, requireUser, resolveTimezone, sendMagicLink } =
  await import("./auth");

const USER_ID = "5a5a5a5a-0000-4000-8000-0000000000aa";

function fakeAuth(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  mocks.client = {
    auth: {
      getClaims: vi.fn(async () => ({ data: null, error: null })),
      signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn(),
      ...overrides,
    },
  };
  return mocks.client.auth;
}

beforeEach(() => {
  mocks.client = null;
  mocks.headers = new Map([["host", "localhost:4317"]]);
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

describe("sendMagicLink", () => {
  it("is not_configured without Supabase", async () => {
    await expect(sendMagicLink({ email: "sam@example.com" })).resolves.toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("links back to /auth/confirm on the site URL with a safe next and the timezone", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://lts-sam.vercel.app");
    const auth = fakeAuth();
    await expect(
      sendMagicLink({
        email: "sam@example.com",
        timezone: "America/Chicago",
        next: "https://evil.example",
      }),
    ).resolves.toEqual({ ok: true });
    const [{ email, options }] = auth.signInWithOtp.mock.calls[0];
    expect(email).toBe("sam@example.com");
    const url = new URL(options.emailRedirectTo);
    expect(url.origin + url.pathname).toBe("https://lts-sam.vercel.app/auth/confirm");
    expect(url.searchParams.get("next")).toBe("/today");
    expect(url.searchParams.get("tz")).toBe("America/Chicago");
  });

  it("falls back to the request host and drops an invalid timezone", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const auth = fakeAuth();
    await sendMagicLink({ email: "sam@example.com", timezone: "Mars/Base", next: "/today?x=1" });
    const url = new URL(auth.signInWithOtp.mock.calls[0][0].options.emailRedirectTo);
    expect(url.origin).toBe("http://localhost:4317");
    expect(url.searchParams.get("next")).toBe("/today?x=1");
    expect(url.searchParams.has("tz")).toBe(false);
  });

  it("maps Supabase's email rate limit", async () => {
    fakeAuth({
      signInWithOtp: vi.fn(async () => ({
        data: {},
        error: { status: 429, code: "over_email_send_rate_limit" },
      })),
    });
    await expect(sendMagicLink({ email: "sam@example.com" })).resolves.toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });
});

describe("completeSignIn failures", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("is not_configured without Supabase", async () => {
    await expect(completeSignIn(params("code=abc"))).resolves.toEqual({
      ok: false,
      notice: "not_configured",
    });
  });

  it.each([
    ["error=access_denied&error_code=otp_expired", "link_expired"],
    ["error=access_denied&error_code=bad_code", "link_invalid"],
    ["", "link_invalid"],
    ["token_hash=abc&type=recovery", "link_invalid"],
  ])("%s → %s", async (query, notice) => {
    fakeAuth();
    await expect(completeSignIn(params(query))).resolves.toEqual({ ok: false, notice });
  });

  it("reports an expired or foreign-browser code as a notice, not a crash", async () => {
    fakeAuth({
      exchangeCodeForSession: vi.fn(async () => ({
        data: { user: null, session: null },
        error: { code: "bad_code_verifier" },
      })),
      verifyOtp: vi.fn(async () => ({
        data: { user: null, session: null },
        error: { code: "otp_expired" },
      })),
    });
    await expect(completeSignIn(params("code=abc"))).resolves.toEqual({
      ok: false,
      notice: "link_invalid",
    });
    await expect(completeSignIn(params("token_hash=abc&type=email"))).resolves.toEqual({
      ok: false,
      notice: "link_expired",
    });
  });
});
