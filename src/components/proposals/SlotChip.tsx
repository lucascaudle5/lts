import type { MissingSlot } from "@/contracts/common";

export function SlotChip({ slot }: { slot: MissingSlot }) {
  return (
    <li className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm">
      <span className="font-medium">{slot.path}</span>
      <span className="ml-2 text-muted-foreground">{slot.reason}</span>
    </li>
  );
}
