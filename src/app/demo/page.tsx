import Link from "next/link";
import type { Metadata } from "next";
import { Sandbox } from "@/app/(life)/LifeWorkspace";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";

export const metadata: Metadata = { title: "Fictional demo · NOVA" };

/** Public fictional data only. No account query, session bypass, or persistent write. */
export default function DemoPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 eyebrow text-muted-foreground">
            <span aria-hidden className="size-2.5 rounded-full bg-gold ring-4 ring-gold/25" />
            NOVA · Life Tracker Suite
          </p>
          <h1 className="text-2xl">Try the workspace</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ThemeSwitch tone="page" />
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center rounded-lg border border-input bg-card px-4 py-2 text-sm shadow-paper hover:bg-surface-2"
          >
            Sign in to your account
          </Link>
        </div>
      </header>
      <Sandbox
        data={{
          today: "2026-10-08",
          timezone: "America/Chicago",
          authority: "ask",
          records: [],
          tasks: [],
          schedule: [],
          observations: [],
          captures: [],
          history: [],
        }}
      />
    </main>
  );
}
