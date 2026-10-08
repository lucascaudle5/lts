import type { ReactNode } from "react";

export interface SectionProps {
  title: string;
  /** Short count or hint shown next to the title. */
  meta?: string;
  children: ReactNode;
}

export function Section({ title, meta, children }: SectionProps) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={id} className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
