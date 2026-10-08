"use client";

import { MailCheck } from "lucide-react";
import { useActionState, useState, useSyncExternalStore } from "react";

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

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** Supabase reports some failed links in the URL fragment, which the server never sees. */
function readHashErrorCode(): string | null {
  return new URLSearchParams(window.location.hash.slice(1)).get("error_code");
}

export interface SignInFormProps {
  action: (state: SignInState, formData: FormData) => Promise<SignInState>;
  next?: string;
  notice?: SignInNotice;
  configured: boolean;
}

export function SignInForm({ action, next, notice, configured }: SignInFormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [editing, setEditing] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const hashErrorCode = useSyncExternalStore(subscribeToHash, readHashErrorCode, () => null);
  const hashNotice: SignInNotice | undefined = hashErrorCode
    ? hashErrorCode === "otp_expired"
      ? "link_expired"
      : "link_invalid"
    : undefined;

  const sent = state.status === "sent" && !editing;
  const sentTo = state.status === "sent" ? state.email : "";
  const shownNotice = notice === "not_configured" ? notice : (hashNotice ?? notice);
  const banner = shownNotice && state.status === "idle" ? NOTICES[shownNotice] : null;

  return (
    <form
      action={(formData) => {
        formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
        setEditing(false);
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

      {sent ? (
        <div className="space-y-4" role="status" aria-live="polite">
          <div className="flex gap-3 rounded-lg border bg-muted/40 p-4">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Check your email</p>
              <p className="text-muted-foreground">
                We sent a sign-in link to{" "}
                <span className="font-medium text-foreground">{sentTo}</span>. Open it on this
                device, in this browser.
              </p>
            </div>
          </div>
          <input type="hidden" name="email" value={sentTo} />
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
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
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
