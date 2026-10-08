import { cn } from "cn";

/** One line of a change: a mono label (ADD, WHEN) and the value. Sits on a kind-tinted card. */
export function DiffRow({
  label,
  value,
  serif = false,
}: {
  label: string;
  value: string;
  serif?: boolean;
}) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-baseline gap-3 rounded-lg bg-card/70 px-3 py-2 text-sm">
      <span className="font-mono text-[11px] tracking-[0.16em] text-ink-soft uppercase">
        {label}
      </span>
      <span
        className={cn("font-medium break-words", serif && "font-heading text-base font-normal")}
      >
        {value}
      </span>
    </div>
  );
}
