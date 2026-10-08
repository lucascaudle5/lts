import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { updatePassword } from "@/app/(auth)/actions";
import { PasswordUpdateForm } from "@/components/auth/PasswordRecoveryForms";
import { getSessionUser } from "@/server/auth";

export const metadata: Metadata = { title: "Choose a password · LTS" };

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-5 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Life Tracker Suite
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">Use at least 8 characters.</p>
      </header>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}>
        <ResetForm />
      </Suspense>
    </main>
  );
}

async function ResetForm() {
  if (!(await getSessionUser())) redirect("/forgot-password?notice=recovery_link_invalid");
  return <PasswordUpdateForm action={updatePassword} />;
}
