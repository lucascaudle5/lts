"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "cn";

import { isActivePath, PRIMARY_NAV, ROOM_NAV } from "./nav";

const SETS = {
  primary: PRIMARY_NAV,
  rooms: ROOM_NAV,
  all: [...PRIMARY_NAV, ...ROOM_NAV],
} as const;

export interface NavLinksProps {
  /** Which links to show. Icons are components, so the choice crosses the server boundary by name. */
  set: keyof typeof SETS;
  label: string;
  className?: string;
  /** Starts a thin divider whenever the hue group changes. */
  grouped?: boolean;
}

export function NavLinks({ set, label, className, grouped = false }: NavLinksProps) {
  const items = SETS[set];
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = ref.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2;
  }, [pathname]);

  return (
    <nav ref={ref} aria-label={label} className={cn("flex items-center gap-0.5", className)}>
      {items.map((item, index) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        const divide = grouped && index > 0 && items[index - 1]!.group !== item.group;
        return (
          <span key={item.href} className="flex shrink-0 items-center">
            {divide ? <span aria-hidden className="mx-1.5 h-5 w-px bg-rail-ink/25" /> : null}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap text-rail-ink/80 transition-colors hover:bg-rail-ink/10 hover:text-rail-ink",
                active && "font-medium text-rail-ink shadow-[inset_0_-3px_0_var(--gold)]",
              )}
            >
              <Icon
                aria-hidden
                className={cn("size-[18px] shrink-0", active && "text-gold")}
                strokeWidth={1.75}
              />
              {item.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
