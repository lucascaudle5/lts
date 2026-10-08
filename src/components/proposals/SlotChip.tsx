import type { MissingSlot } from "@/contracts/common";

export function SlotChip({ slot }: { slot: MissingSlot }) {
  return (
    <li className="rounded-md border border-dashed border-line-strong/60 bg-surface-2 px-3 py-2 text-sm">
      <span className="font-mono text-xs">{slot.path}</span>
      <span className="ml-2 text-ink-soft">{slot.reason}</span>
    </li>
  );
}
