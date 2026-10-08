import "server-only";

import type { EmailOtpType } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { PasswordResetRequest, SignInRequest } from "@/contracts/auth";
import { Timezone, Uuid } from "@/contracts/common";
import { SIGN_IN_PATH } from "@/server/access";
import { getDb, type Db } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { getProfile, type ProfileRow } from "@/server/repositories/profiles";
import { createRequestAuthClient } from "@/server/supabase";

/** Used when the sign-in form carried no valid browser timezone. */
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

export type PasswordSignInResult =
  { ok: true } | { ok: false; reason: "not_configured" | "invalid_credentials" | "failed" };

/** Sign in without sending an email; Supabase verifies the credentials and stores the session. */
export async function signInWithPassword(request: SignInRequest): Promise<PasswordSignInResult> {
  const supabase = await createRequestAuthClient();
  if (!supabase) return { ok: false, reason: "not_configured" };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: request.email,
    password: request.password,
  });
  if (!error && data.user) {
    await ensureProfile(data.user.id, resolveTimezone(request.timezone));
    return { ok: true };
  }

  if (error?.code === "invalid_credentials" || error?.code === "email_not_confirmed") {
    return { ok: false, reason: "invalid_credentials" };
  }
  console.error("signInWithPassword failed", error?.code ?? error?.status ?? "missing_user");
  return { ok: false, reason: "failed" };
}

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured).origin;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:4317";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type PasswordResetResult =
  { ok: true } | { ok: false; reason: "not_configured" | "rate_limited" | "failed" };

/** Email is used only for explicit account recovery, not routine sign-in. */
export async function sendPasswordReset(
  request: PasswordResetRequest,
): Promise<PasswordResetResult> {
  const supabase = await createRequestAuthClient();
  if (!supabase) return { ok: false, reason: "not_configured" };
  const redirectTo = new URL("/auth/confirm", await siteOrigin()).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(request.email, { redirectTo });
  if (!error) return { ok: true };
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    return { ok: false, reason: "rate_limited" };
  }
  console.error("resetPasswordForEmail failed", error.code ?? error.status);
  return { ok: false, reason: "failed" };
}

export type CompletePasswordRecoveryResult = { ok: true } | { ok: false };

/** Exchanges a single-use Supabase PKCE recovery code into the browser session. */
export async function completePasswordRecovery(
  params: URLSearchParams,
): Promise<CompletePasswordRecoveryResult> {
  const supabase = await createRequestAuthClient();
  if (!supabase || params.has("error_code")) return { ok: false };

  const code = params.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    return !error && Boolean(data.user) ? { ok: true } : { ok: false };
  }

  const tokenHash = params.get("token_hash");
  if (tokenHash && params.get("type") === "recovery") {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery" satisfies EmailOtpType,
    });
    return !error && Boolean(data.user) ? { ok: true } : { ok: false };
  }
  return { ok: false };
}

export async function updatePassword(password: string): Promise<boolean> {
  const supabase = await createRequestAuthClient();
  if (!supabase) return false;
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !Uuid.safeParse(claims?.claims?.sub).success) return false;
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("updateUser password failed", error.code ?? error.status);
    return false;
  }
  return true;
}

export async function signOutCurrentUser(): Promise<void> {
  const supabase = await createRequestAuthClient();
  await supabase?.auth.signOut({ scope: "local" });
}
