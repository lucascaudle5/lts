import { cn } from "cn";
import type { ReactNode } from "react";

export interface SectionProps {
  title: string;
  /** Short count or hint shown beside the title. */
  meta?: string;
  /** Hue group; the panel's dot and edge follow it. */
  room?: "nova" | "plan" | "practice" | "self" | "quiet";
  /** Lifted panel on the second paper level, for secondary content. */
  panel?: boolean;
  className?: string;
  children: ReactNode;
}

export function Section({ title, meta, room, panel = false, className, children }: SectionProps) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      data-room={room}
      className={cn(
        "space-y-3",
        panel && "rounded-2xl border border-t-4 border-t-room bg-surface-2 p-4 shadow-paper sm:p-5",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={id} className="text-xl leading-7">
          {title}
        </h2>
        {meta ? <span className="eyebrow text-muted-foreground">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line-strong/50 px-4 py-3 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
