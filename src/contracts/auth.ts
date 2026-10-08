import { z } from "zod";

export const SignInRequest = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254)),
  password: z.string().min(1, "Enter your password.").max(256),
  /** The browser's IANA timezone; the first sign-in stores it on the profile. */
  timezone: z.string().max(64).optional(),
  /** Same-site path to land on after signing in. */
  next: z.string().max(512).optional(),
});
export type SignInRequest = z.infer<typeof SignInRequest>;

export type SignInState =
  | { status: "idle" }
  | { status: "invalid"; email: string; message: string }
  | { status: "error"; email: string; message: string };

/** Why `/sign-in` was reached after a failed request. */
export const SignInNotice = z.enum(["not_configured", "signed_out", "recovery_link_invalid"]);
export type SignInNotice = z.infer<typeof SignInNotice>;

export const PasswordResetRequest = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254)),
});
export type PasswordResetRequest = z.infer<typeof PasswordResetRequest>;

export const PasswordUpdateRequest = z.object({
  password: z.string().min(8, "Use at least 8 characters.").max(256),
  confirmPassword: z.string().max(256),
});

export type PasswordResetState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

export type PasswordUpdateState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string }
  | { status: "updated" };
