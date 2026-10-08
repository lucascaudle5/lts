import { cn } from "cn";

import type { TodayBlock } from "@/contracts/today";
import { Badge } from "@/components/ui/badge";

import { BLOCK_KIND_ACCENT, BLOCK_KIND_LABEL } from "./labels";
import { ProvenanceLink } from "./ProvenanceLink";

export function BlockRow({ block, showTiming }: { block: TodayBlock; showTiming: boolean }) {
  const isNow = showTiming && block.timing === "now";
  const isPast = showTiming && block.timing === "past";
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-lg border border-l-4 border-l-(--k) bg-(--k-soft) px-3 py-2.5",
        BLOCK_KIND_ACCENT[block.blockKind],
        !block.fixed && "border-dashed",
        isNow && "ring-2 ring-primary/30",
        isPast && "opacity-60",
      )}
    >
      <div className="w-[7.5rem] shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums sm:w-36 sm:text-sm">
        {block.timeLabel}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="leading-snug font-medium break-words">{block.title}</p>
        <ProvenanceLink provenance={block.provenance} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{BLOCK_KIND_LABEL[block.blockKind]}</Badge>
          <Badge variant="outline">{block.fixed ? "Fixed" : "Flexible"}</Badge>
          {isNow ? <Badge>Now</Badge> : null}
        </div>
      </div>
    </li>
  );
}
