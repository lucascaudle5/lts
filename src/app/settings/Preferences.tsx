"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function Preferences({
  timezone,
  authority,
  act,
}: {
  timezone: string;
  authority: string;
  act: (input: unknown) => Promise<{ ok: boolean; message: string }>;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  const input = "min-h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm";
  return (
    <form
      className="space-y-4 rounded-2xl border bg-card p-5 shadow-paper"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        start(async () => {
          const result = await act({
            op: "profile.save",
            timezone: fd.get("timezone"),
            authority: fd.get("authority"),
          });
          setMessage(result.message);
          if (result.ok) router.refresh();
        });
      }}
    >
      <h2 className="text-lg">Timezone and NOVA authority</h2>
      <label className="grid gap-1 text-sm">
        Timezone
        <input
          required
          name="timezone"
          className={input}
          defaultValue={timezone}
          placeholder="America/Chicago"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Explicit low-risk commands
        <select className={input} name="authority" defaultValue={authority}>
          <option value="ask">Ask first</option>
          <option value="allow_explicit">Always allow explicit task additions</option>
        </select>
      </label>
      <p className="text-xs text-muted-foreground">
        With Always allow, “Add task: buy milk” saves that reversible task directly. Interpretive
        notes, schedule changes, sensitive logs, and bulk actions still require review. Changing
        timezone changes how saved instants are displayed.
      </p>
      <button
        disabled={pending}
        className="min-h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground"
      >
        {pending ? "Saving…" : "Save preferences"}
      </button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
