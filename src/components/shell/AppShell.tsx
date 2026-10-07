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
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/today" className="font-semibold tracking-tight">
              LTS
            </Link>
            <Link href="/today" className="text-muted-foreground hover:text-foreground">
              Today
            </Link>
          </nav>
          {account}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
