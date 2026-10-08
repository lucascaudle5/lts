import type { CommandKind } from "@/contracts/commands";
import { BlockKind, ObservationCategory, TaskKind, type MissingSlot } from "@/contracts/common";
import type { ProposalStatus } from "@/contracts/proposals";

interface RequiredField {
  path: string;
  reason: string;
  options?: readonly string[];
}

const REQUIRED_FIELDS: Record<CommandKind, RequiredField[]> = {
  "schedule_block.create": [
    { path: "title", reason: "What should this be called?" },
    { path: "blockKind", reason: "What kind of time is this?", options: BlockKind.options },
    { path: "date", reason: "Which day?" },
    { path: "start", reason: "When does it start?" },
    { path: "end", reason: "When does it end?" },
  ],
  "task.create": [
    { path: "title", reason: "What's the task?" },
    { path: "taskKind", reason: "What kind of task is this?", options: TaskKind.options },
  ],
  // Updates are direct commands only; they aren't partial proposal cards.
  "task.update": [],
  "observation.record": [
    { path: "category", reason: "What is this about?", options: ObservationCategory.options },
    { path: "valueText", reason: "What did you say?" },
    { path: "occurredOn", reason: "Which day was this?" },
  ],
};

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

/** Required fields that are still empty in a partial payload. */
export function computeMissingSlots(
  kind: CommandKind,
  payload: Readonly<Record<string, unknown>>,
): MissingSlot[] {
  return REQUIRED_FIELDS[kind]
    .filter((field) => isEmpty(payload[field.path]))
    .map(({ path, reason, options }) =>
      options ? { path, reason, options: [...options] } : { path, reason },
    );
}

/** Keeps the first slot per path, so a "missing" reason is not repeated by a validation reason. */
export function mergeSlots(...lists: MissingSlot[][]): MissingSlot[] {
  const seen = new Set<string>();
  return lists.flat().filter((slot) => {
    if (seen.has(slot.path)) return false;
    seen.add(slot.path);
    return true;
  });
}

export function statusFromSlots(
  slots: readonly MissingSlot[],
): Extract<ProposalStatus, "ready" | "needs_input"> {
  return slots.length === 0 ? "ready" : "needs_input";
}
