"use server";

import { redirect } from "next/navigation";

import { SignInRequest, type SignInState } from "@/contracts/auth";
import { sendMagicLink, signOutCurrentUser } from "@/server/auth";

const SEND_FAILURES = {
  not_configured: "Sign-in isn't set up on this server yet.",
  rate_limited: "Too many links were requested. Wait a few minutes, then try again.",
  failed: "We couldn't send the link. Check your connection and try again.",
} as const;

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value !== "" ? value : undefined;
}

export async function requestMagicLink(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = field(formData, "email") ?? "";
  const parsed = SignInRequest.safeParse({
    email,
    timezone: field(formData, "timezone"),
    next: field(formData, "next"),
  });
  if (!parsed.success) {
    return { status: "invalid", email, message: "Enter a valid email address." };
  }
  const result = await sendMagicLink(parsed.data);
  return result.ok
    ? { status: "sent", email: parsed.data.email }
    : { status: "error", email, message: SEND_FAILURES[result.reason] };
}

export async function signOut(): Promise<void> {
  await signOutCurrentUser();
  redirect("/sign-in?notice=signed_out");
}
