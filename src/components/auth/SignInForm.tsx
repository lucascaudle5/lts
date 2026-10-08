"use client";

import { useActionState } from "react";
import Link from "next/link";

import type { SignInNotice, SignInState } from "@/contracts/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NOTICES: Record<SignInNotice, { title: string; body: string; tone: "default" | "error" }> = {
  not_configured: {
    title: "Sign-in isn't set up yet",
    body: "This server has no Supabase Auth settings. See the README to configure them.",
    tone: "error",
  },
  signed_out: { title: "You're signed out", body: "See you soon.", tone: "default" },
  recovery_link_invalid: {
    title: "That reset link didn't work",
    body: "Request a new password reset link and open it in this browser.",
    tone: "error",
  },
};

export interface SignInFormProps {
  action: (state: SignInState, formData: FormData) => Promise<SignInState>;
  next?: string;
  notice?: SignInNotice;
  configured: boolean;
}

export function SignInForm({ action, next, notice, configured }: SignInFormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const banner = notice && state.status === "idle" ? NOTICES[notice] : null;

  return (
    <form
      action={(formData) => {
        formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
        formAction(formData);
      }}
      className="space-y-5"
      noValidate
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {banner ? (
        <Alert variant={banner.tone === "error" ? "destructive" : "default"}>
          <AlertTitle>{banner.title}</AlertTitle>
          <AlertDescription>{banner.body}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="you@example.com"
            defaultValue={state.status === "idle" ? "" : state.email}
            disabled={!configured || pending}
            aria-invalid={state.status === "invalid" || undefined}
            aria-describedby={state.status === "invalid" ? "sign-in-error" : undefined}
            className="h-11 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={!configured || pending}
            aria-invalid={state.status === "invalid" || undefined}
            aria-describedby={state.status === "invalid" ? "sign-in-error" : undefined}
            className="h-11 text-base"
          />
        </div>

        {state.status === "invalid" ? (
          <p id="sign-in-error" className="text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.status === "error" ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" className="h-11 w-full text-base" disabled={pending || !configured}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link className="underline underline-offset-4" href="/forgot-password">
            Forgot password?
          </Link>
        </p>
      </div>
    </form>
  );
}
