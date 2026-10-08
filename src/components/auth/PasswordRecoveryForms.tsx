"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { PasswordResetState, PasswordUpdateState } from "@/contracts/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordResetRequestForm({
  action,
}: {
  action: (state: PasswordResetState, formData: FormData) => Promise<PasswordResetState>;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  if (state.status === "sent") {
    return (
      <Alert role="status">
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>
          If an account uses that email, Supabase will send a password reset link.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="you@example.com"
          disabled={pending}
          aria-invalid={state.status === "invalid" || undefined}
          className="h-11 text-base"
        />
      </div>
      {state.status === "invalid" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "error" ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
        {pending ? "Requesting link…" : "Email me a reset link"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link className="underline underline-offset-4" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function PasswordUpdateForm({
  action,
}: {
  action: (state: PasswordUpdateState, formData: FormData) => Promise<PasswordUpdateState>;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  if (state.status === "updated") {
    return (
      <Alert role="status">
        <AlertTitle>Password updated</AlertTitle>
        <AlertDescription>
          <Link className="underline underline-offset-4" href="/today">
            Continue to Today
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
          aria-invalid={state.status === "invalid" || undefined}
          className="h-11 text-base"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
          aria-invalid={state.status === "invalid" || undefined}
          className="h-11 text-base"
        />
      </div>
      {state.status === "invalid" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "error" ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
        {pending ? "Updating…" : "Set password"}
      </Button>
    </form>
  );
}
