import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { NavLinks } from "./NavLinks";

export interface AppShellProps {
  account: ReactNode;
  children: ReactNode;
}

const NAV_FALLBACK = <div className="h-11" aria-hidden />;

/**
 * The dark rail: wordmark and account on top, the rooms below. Phones keep the same top nav and
 * scroll it sideways; there is no bottom bar.
 */
export function AppShell({ account, children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 bg-rail text-rail-ink shadow-paper">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 pt-1 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/today"
              className="flex min-h-11 items-center gap-2.5 rounded-md"
              aria-label="NOVA, go to Today"
            >
              <span aria-hidden className="size-3 rounded-full bg-gold ring-4 ring-gold/25" />
              <span className="font-mono text-sm font-semibold tracking-[0.24em]">NOVA</span>
            </Link>
            <Suspense fallback={NAV_FALLBACK}>
              <NavLinks set="primary" label="Main" className="hidden md:flex" />
            </Suspense>
          </div>
          <div className="flex shrink-0 items-center gap-2">{account}</div>
        </div>
        <div className="mx-auto w-full max-w-7xl px-2 pb-1 sm:px-4">
          <Suspense fallback={NAV_FALLBACK}>
            <NavLinks set="all" label="Life rooms" grouped className="overflow-x-auto md:hidden" />
            <NavLinks
              set="rooms"
              label="Rooms"
              grouped
              className="hidden overflow-x-auto md:flex"
            />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
