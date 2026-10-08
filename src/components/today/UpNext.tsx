import { cn } from "cn";

import { BLOCK_KIND_LABEL } from "./labels";
import type { TodayModel } from "./model";
import { ProvenanceLink } from "./ProvenanceLink";

/** The one block that matters right now, large. On a heavy day it takes the quiet blue, not gold. */
export function UpNext({ model }: { model: TodayModel }) {
  const next = model.upNext;
  if (!next) return null;
  const { block, now } = next;
  const gold = now && model.load !== "heavy";
  return (
    <section
      aria-label={now ? "Happening now" : "Up next"}
      className={cn(
        "rounded-2xl border border-l-[6px] p-5 shadow-raised sm:p-6",
        gold
          ? "border-gold border-l-gold bg-gold text-gold-ink"
          : "border-l-room bg-room-soft text-foreground",
      )}
    >
      <p
        className={cn("flex items-center gap-2 eyebrow", gold ? "text-gold-ink" : "text-room-ink")}
      >
        <span aria-hidden className={cn("size-2 rounded-full", gold ? "bg-gold-ink" : "bg-room")} />
        {now ? "Now" : "Up next"}
      </p>
      <h2 className="mt-2 text-2xl leading-8 break-words sm:text-[1.75rem]">{block.title}</h2>
      <p className="mt-1 font-mono text-sm tabular-nums">{block.timeLabel}</p>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5",
            gold ? "border-gold-ink/40 bg-gold-ink/10" : "border-line-strong/50 bg-card/70",
          )}
        >
          {BLOCK_KIND_LABEL[block.blockKind]}
        </span>
        <span>{block.fixed ? "Fixed" : "Flexible"}</span>
      </p>
      <div className={cn("mt-2", gold && "[&_a]:text-gold-ink")}>
        <ProvenanceLink provenance={block.provenance} />
      </div>
    </section>
  );
}
