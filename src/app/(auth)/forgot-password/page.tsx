import type { Metadata } from "next";

import { requestPasswordReset } from "@/app/(auth)/actions";
import { PasswordResetRequestForm } from "@/components/auth/PasswordRecoveryForms";

export const metadata: Metadata = { title: "Reset password · LTS" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-5 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Life Tracker Suite
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          We’ll email a reset link if there’s an account for that address. If a link failed, request
          another and open it in this browser.
        </p>
      </header>
      <PasswordResetRequestForm action={requestPasswordReset} />
    </main>
  );
}
