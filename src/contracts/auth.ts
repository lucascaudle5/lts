import { z } from "zod";

export const SignInRequest = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254)),
  /** The browser's IANA timezone; the first sign-in stores it on the profile. */
  timezone: z.string().max(64).optional(),
  /** Same-site path to land on after the link is opened. */
  next: z.string().max(512).optional(),
});
export type SignInRequest = z.infer<typeof SignInRequest>;

export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "invalid"; email: string; message: string }
  | { status: "error"; email: string; message: string };

/** Why `/sign-in` was reached after a failed link; drives the banner copy. */
export const SignInNotice = z.enum([
  "link_expired",
  "link_invalid",
  "not_configured",
  "signed_out",
]);
export type SignInNotice = z.infer<typeof SignInNotice>;
