import { cn } from "cn";
import type { ReactNode } from "react";

export interface RoomCardProps {
  /** Mono line above the title: an anchor, a date, a kind. */
  eyebrow?: string;
  title: string;
  /** Once the thing is done the card settles into the room's soft tint. */
  settled?: boolean;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * The shared card for a room's things (routines first, habits next): an eyebrow, a serif title,
 * a body and a footer of actions. It takes its hue from the nearest `data-room`, so one component
 * serves every room. Replaces the label/value dump that `RecordCard` used for every record type.
 */
export function RoomCard({
  eyebrow,
  title,
  settled = false,
  footer,
  className,
  children,
}: RoomCardProps) {
  return (
    <article
      data-settled={settled || undefined}
      className={cn(
        "space-y-4 rounded-2xl border border-t-4 border-t-room bg-card p-4 shadow-paper transition-colors duration-300 motion-reduce:transition-none sm:p-5",
        settled && "border-room/40 border-t-room bg-room-soft",
        className,
      )}
    >
      <header className="space-y-1">
        {eyebrow ? <p className="font-mono text-xs text-muted-foreground">{eyebrow}</p> : null}
        <h3 className="text-xl leading-7 break-words">{title}</h3>
      </header>
      {children}
      {footer ? <footer className="flex flex-wrap items-center gap-2">{footer}</footer> : null}
    </article>
  );
}
