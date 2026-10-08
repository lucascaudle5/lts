import { cn } from "cn";

import type { TodayBlock } from "@/contracts/today";

import { BLOCK_KIND_ACCENT, BLOCK_KIND_LABEL } from "./labels";
import { ProvenanceLink } from "./ProvenanceLink";

/** One block as a row: mono time, the title, and a chip in the block's own hue. */
export function BlockRow({ block, quiet = false }: { block: TodayBlock; quiet?: boolean }) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-lg border border-l-4 border-l-(--k) bg-(--k-soft) px-3 py-2.5 text-foreground",
        BLOCK_KIND_ACCENT[block.blockKind],
        !block.fixed && "border-dashed",
        quiet && "bg-surface-2",
      )}
    >
      <div className="w-[7.5rem] shrink-0 pt-0.5 font-mono text-xs text-ink-soft tabular-nums sm:w-36 sm:text-[13px]">
        {block.timeLabel}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="leading-snug font-medium break-words">{block.title}</p>
        <ProvenanceLink provenance={block.provenance} />
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
          <span className="rounded-full border border-(--k)/50 bg-card/70 px-2 py-0.5">
            {BLOCK_KIND_LABEL[block.blockKind]}
          </span>
          <span>{block.fixed ? "Fixed" : "Flexible"}</span>
        </p>
      </div>
    </li>
  );
}
