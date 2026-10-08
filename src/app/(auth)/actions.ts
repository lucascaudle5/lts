"use server";

import { redirect } from "next/navigation";

import {
  PasswordResetRequest,
  PasswordUpdateRequest,
  SignInRequest,
  type PasswordResetState,
  type PasswordUpdateState,
  type SignInState,
} from "@/contracts/auth";
import {
  sendPasswordReset,
  signInWithPassword,
  signOutCurrentUser,
  updatePassword as updateUserPassword,
} from "@/server/auth";
import { safeNextPath } from "@/server/access";

const SIGN_IN_FAILURES = {
  not_configured: "Sign-in isn't set up on this server yet.",
  invalid_credentials: "Email or password is incorrect.",
  failed: "We couldn't sign you in. Check your connection and try again.",
} as const;

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value !== "" ? value : undefined;
}

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = field(formData, "email") ?? "";
  const password = field(formData, "password") ?? "";
  const parsed = SignInRequest.safeParse({
    email,
    password,
    timezone: field(formData, "timezone"),
    next: field(formData, "next"),
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      email,
      message: password ? "Enter a valid email address." : "Enter your email and password.",
    };
  }
  const result = await signInWithPassword(parsed.data);
  if (result.ok) redirect(safeNextPath(parsed.data.next));
  return { status: "error", email, message: SIGN_IN_FAILURES[result.reason] };
}

export async function requestPasswordReset(
  _previous: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const parsed = PasswordResetRequest.safeParse({ email: field(formData, "email") ?? "" });
  if (!parsed.success) return { status: "invalid", message: "Enter a valid email address." };
  const result = await sendPasswordReset(parsed.data);
  if (result.ok) return { status: "sent" };
  const message =
    result.reason === "not_configured"
      ? "Password recovery isn't set up on this server yet."
      : result.reason === "rate_limited"
        ? "Supabase is temporarily limiting recovery emails. Wait before requesting another."
        : "We couldn't request a password reset. Check your connection and try again.";
  return { status: "error", message };
}

export async function updatePassword(
  _previous: PasswordUpdateState,
  formData: FormData,
): Promise<PasswordUpdateState> {
  const parsed = PasswordUpdateRequest.safeParse({
    password: field(formData, "password") ?? "",
    confirmPassword: field(formData, "confirmPassword") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      message: parsed.error.issues[0]?.message ?? "Check your password.",
    };
  }
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { status: "invalid", message: "The passwords don't match." };
  }
  const updated = await updateUserPassword(parsed.data.password);
  return updated
    ? { status: "updated" }
    : { status: "error", message: "We couldn't update your password. Request a new reset link." };
}

export async function signOut(): Promise<void> {
  await signOutCurrentUser();
  redirect("/sign-in?notice=signed_out");
}
