import Link from "next/link";
import type { Metadata } from "next";
import { Sandbox } from "@/app/(life)/LifeWorkspace";

export const metadata: Metadata = { title: "Fictional demo · NOVA" };

/** Public fictional data only. No account query, session bypass, or persistent write. */
export default function DemoPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">NOVA · Life Tracker Suite</p>
          <h1 className="text-2xl font-semibold">Try the workspace</h1>
        </div>
        <Link href="/sign-in" className="min-h-10 rounded-lg border px-4 py-2 text-sm">
          Sign in to your account
        </Link>
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
