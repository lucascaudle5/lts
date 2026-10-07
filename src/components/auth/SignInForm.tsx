"use client";

import { MailCheck } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import type { SignInNotice, SignInState } from "@/contracts/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NOTICES: Record<SignInNotice, { title: string; body: string; tone: "default" | "error" }> = {
  link_expired: {
    title: "That link has expired",
    body: "Sign-in links work once and expire after an hour. Send yourself a new one.",
    tone: "error",
  },
  link_invalid: {
    title: "That link didn't work",
    body: "Open the link in the same browser where you asked for it, or send a new one below.",
    tone: "error",
  },
  not_configured: {
    title: "Sign-in isn't set up yet",
    body: "This server has no Supabase Auth settings. See the README to configure them.",
    tone: "error",
  },
  signed_out: { title: "You're signed out", body: "See you soon.", tone: "default" },
};

export interface SignInFormProps {
  action: (state: SignInState, formData: FormData) => Promise<SignInState>;
  next?: string;
  notice?: SignInNotice;
  configured: boolean;
}

export function SignInForm({ action, next, notice, configured }: SignInFormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [editing, setEditing] = useState(false);
  const timezoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (timezoneRef.current) {
      timezoneRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  }, []);

  const sent = state.status === "sent" && !editing;
  const email = state.status === "idle" ? "" : state.email;
  const banner = notice && state.status === "idle" ? NOTICES[notice] : null;

  return (
    <form
      action={(formData) => {
        setEditing(false);
        formAction(formData);
      }}
      className="space-y-5"
      noValidate
    >
      <input ref={timezoneRef} type="hidden" name="timezone" defaultValue="" />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {banner ? (
        <Alert variant={banner.tone === "error" ? "destructive" : "default"}>
          <AlertTitle>{banner.title}</AlertTitle>
          <AlertDescription>{banner.body}</AlertDescription>
        </Alert>
      ) : null}

      {sent ? (
        <div className="space-y-4" role="status" aria-live="polite">
          <div className="flex gap-3 rounded-lg border bg-muted/40 p-4">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Check your email</p>
              <p className="text-muted-foreground">
                We sent a sign-in link to{" "}
                <span className="font-medium text-foreground">{email}</span>. Open it on this
                device, in this browser.
              </p>
            </div>
          </div>
          <input type="hidden" name="email" value={email} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="outline" disabled={pending} className="h-10 sm:flex-1">
              {pending ? "Sending…" : "Send another link"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 sm:flex-1"
              onClick={() => setEditing(true)}
            >
              Use a different email
            </Button>
          </div>
        </div>
      ) : (
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
              defaultValue={email}
              disabled={!configured}
              aria-invalid={state.status === "invalid" || undefined}
              aria-describedby={state.status === "invalid" ? "email-error" : undefined}
              className="h-11 text-base"
            />
            {state.status === "invalid" ? (
              <p id="email-error" className="text-sm text-destructive">
                {state.message}
              </p>
            ) : null}
          </div>

          {state.status === "error" ? (
            <Alert variant="destructive" aria-live="polite">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="h-11 w-full text-base" disabled={pending || !configured}>
            {pending ? "Sending link…" : "Send link"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            No password. We email you a one-time link.
          </p>
        </div>
      )}
    </form>
  );
}
