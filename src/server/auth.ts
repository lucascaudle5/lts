import "server-only";

import type { EmailOtpType } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { SignInNotice, SignInRequest } from "@/contracts/auth";
import { Timezone, Uuid } from "@/contracts/common";
import { safeNextPath, SIGN_IN_PATH } from "@/server/access";
import { getDb, type Db } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { getProfile, type ProfileRow } from "@/server/repositories/profiles";
import { createRequestAuthClient } from "@/server/supabase";

/** Used only when the sign-in link carried no valid browser timezone. */
export const DEFAULT_TIMEZONE = "UTC";

export interface SessionUser {
  userId: string;
  email: string | null;
}

export interface CurrentUser extends SessionUser {
  timezone: string;
}

export function resolveTimezone(value: unknown): string {
  return Timezone.safeParse(value).success ? (value as string) : DEFAULT_TIMEZONE;
}

/** The verified session user, or null. Never trusts an unverified cookie payload. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createRequestAuthClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !Uuid.safeParse(sub).success) return null;
  const email = data?.claims?.email;
  return { userId: sub as string, email: typeof email === "string" ? email : null };
});

/**
 * Creates the profile on first sign-in; an existing profile (and its timezone) is left untouched.
 * This is account provisioning, not a settings change, so it does not go through the mutation
 * layer; later edits to profile settings will.
 */
export async function ensureProfile(
  userId: string,
  timezone: string,
  db: Db = getDb(),
): Promise<ProfileRow> {
  const [created] = await db
    .insert(profiles)
    .values({ userId, timezone: resolveTimezone(timezone) })
    .onConflictDoNothing({ target: profiles.userId })
    .returning({ userId: profiles.userId, timezone: profiles.timezone });
  if (created) return created;
  const existing = await getProfile(userId, db);
  if (!existing) throw new Error("Profile bootstrap failed");
  return existing;
}

/** Every protected page, Server Action, and Route Handler starts here. */
export async function requireUser(db?: Db): Promise<CurrentUser> {
  const session = await getSessionUser();
  if (!session) redirect(SIGN_IN_PATH);
  const profile =
    (await getProfile(session.userId, db)) ??
    (await ensureProfile(session.userId, DEFAULT_TIMEZONE, db));
  return { ...session, timezone: profile.timezone };
}

/** Prefer the configured site URL so magic links always match Supabase's redirect allow-list. */
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured).origin;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:4317";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type SendLinkResult =
  { ok: true } | { ok: false; reason: "not_configured" | "rate_limited" | "failed" };

export async function sendMagicLink(request: SignInRequest): Promise<SendLinkResult> {
  const supabase = await createRequestAuthClient();
  if (!supabase) return { ok: false, reason: "not_configured" };

  const confirmUrl = new URL("/auth/confirm", await siteOrigin());
  confirmUrl.searchParams.set("next", safeNextPath(request.next));
  if (request.timezone && Timezone.safeParse(request.timezone).success) {
    confirmUrl.searchParams.set("tz", request.timezone);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: request.email,
    options: { emailRedirectTo: confirmUrl.toString(), shouldCreateUser: true },
  });
  if (!error) return { ok: true };
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    return { ok: false, reason: "rate_limited" };
  }
  console.error("signInWithOtp failed", error.code ?? error.status);
  return { ok: false, reason: "failed" };
}

const EMAIL_OTP_TYPES = new Set<EmailOtpType>(["email", "magiclink", "signup"]);

export type CompleteSignInResult = { ok: true; next: string } | { ok: false; notice: SignInNotice };

/**
 * Finishes a magic-link sign-in from `/auth/confirm`. Supports the default email template (PKCE
 * `code`, which must be opened in the browser that asked for the link) and a `token_hash`
 * template (works in any browser).
 */
export async function completeSignIn(params: URLSearchParams): Promise<CompleteSignInResult> {
  const supabase = await createRequestAuthClient();
  if (!supabase) return { ok: false, notice: "not_configured" };

  const errorCode = params.get("error_code");
  if (errorCode) {
    return { ok: false, notice: errorCode === "otp_expired" ? "link_expired" : "link_invalid" };
  }

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type && EMAIL_OTP_TYPES.has(type)
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : null;
  if (!result) return { ok: false, notice: "link_invalid" };

  const { data, error } = result;
  if (error || !data.user) {
    return { ok: false, notice: error?.code === "otp_expired" ? "link_expired" : "link_invalid" };
  }

  await ensureProfile(data.user.id, resolveTimezone(params.get("tz")));
  return { ok: true, next: safeNextPath(params.get("next")) };
}

export async function signOutCurrentUser(): Promise<void> {
  const supabase = await createRequestAuthClient();
  await supabase?.auth.signOut({ scope: "local" });
}
