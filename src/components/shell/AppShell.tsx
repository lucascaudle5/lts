import Link from "next/link";
import type { ReactNode } from "react";

export interface AppShellProps {
  account: ReactNode;
  children: ReactNode;
}

export function AppShell({ account, children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-5 text-sm">
            <Link href="/today" className="font-semibold tracking-tight">
              NOVA
            </Link>
            <Link href="/today" className="text-muted-foreground hover:text-foreground">
              Today
            </Link>
            <Link href="/inbox" className="text-muted-foreground hover:text-foreground">
              Inbox
            </Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              Settings
            </Link>
          </div>
          {account}
        </div>
        <nav
          aria-label="Life rooms"
          className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 pb-2 text-sm sm:px-6"
        >
          {[
            ["schedule", "Schedule"],
            ["tasks", "Tasks"],
            ["habits", "Habits"],
            ["routines", "Routines"],
            ["projects", "Projects"],
            ["fitness", "Fitness"],
            ["diet", "Food"],
            ["mind", "Sleep & state"],
            ["money", "Money"],
            ["review", "Review"],
            ["history", "History"],
            ["archive", "Archive"],
            ["sandbox", "Sandbox"],
          ].map(([route, label]) => (
            <Link
              key={route}
              href={`/${route}`}
              className="shrink-0 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
