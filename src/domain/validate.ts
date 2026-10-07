import type { IsoDate, MissingSlot, Warning } from "@/contracts/common";
import type { ProposalDraft, ProposalStatus } from "@/contracts/proposals";

import {
  findDuplicateTasks,
  findFixedBlockConflicts,
  type ExistingBlock,
  type ExistingTask,
} from "./conflicts";
import { daysBetween, formatTime12h } from "./dates";
import { computeMissingSlots, mergeSlots, statusFromSlots } from "./slots";

/** Dates further than this from the reference date are almost always a misread. */
export const MAX_DAYS_IN_PAST = 366;
export const MAX_DAYS_AHEAD = 731;

export interface AssessmentContext {
  referenceDate: IsoDate;
  existingBlocks?: readonly ExistingBlock[];
  openTasks?: readonly ExistingTask[];
}

export interface Assessment {
  status: Extract<ProposalStatus, "ready" | "needs_input">;
  missingSlots: MissingSlot[];
  warnings: Warning[];
}

function dateOutOfRange(path: string, date: IsoDate, referenceDate: IsoDate): MissingSlot | null {
  const offset = daysBetween(referenceDate, date);
  if (offset < -MAX_DAYS_IN_PAST || offset > MAX_DAYS_AHEAD) {
    return { path, reason: "That date is far from today. Which day did you mean?" };
  }
  return null;
}

/** Business rules on the fields that are present (pipeline step 6). */
export function validateDraft(
  draft: ProposalDraft,
  ctx: AssessmentContext,
): { missingSlots: MissingSlot[]; warnings: Warning[] } {
  const slots: MissingSlot[] = [];
  const warnings: Warning[] = [];

  if (draft.kind === "schedule_block.create") {
    const { date, start, end } = draft.payload;
    if (date) {
      const slot = dateOutOfRange("date", date, ctx.referenceDate);
      if (slot) slots.push(slot);
    }
    if (start && end && end <= start) {
      slots.push({ path: "end", reason: "The end time has to be after the start time." });
    }
    if (date && start && end && end > start) {
      for (const block of findFixedBlockConflicts({ date, start, end }, ctx.existingBlocks ?? [])) {
        warnings.push({
          code: "conflicts_with_fixed_block",
          message: `Overlaps "${block.title}" (${formatTime12h(block.start)}–${formatTime12h(block.end)})`,
        });
      }
    }
  } else if (draft.kind === "task.create") {
    const { dueOn, title } = draft.payload;
    if (dueOn) {
      const slot = dateOutOfRange("dueOn", dueOn, ctx.referenceDate);
      if (slot) slots.push(slot);
    }
    if (title) {
      for (const task of findDuplicateTasks(title, ctx.openTasks ?? [])) {
        warnings.push({
          code: "possible_duplicate_task",
          message: `You already have "${task.title}" open`,
        });
      }
    }
  } else {
    const { occurredOn } = draft.payload;
    if (occurredOn) {
      if (daysBetween(ctx.referenceDate, occurredOn) > 0) {
        slots.push({
          path: "occurredOn",
          reason: "This can't be in the future. Which day was it?",
        });
      } else {
        const slot = dateOutOfRange("occurredOn", occurredOn, ctx.referenceDate);
        if (slot) slots.push(slot);
      }
    }
  }

  if (draft.confidence === "low") {
    warnings.push({ code: "low_confidence", message: "Not sure about this one. Please check it." });
  }

  return { missingSlots: slots, warnings };
}

/** Missing slots + business rules → the status the review screen shows (pipeline steps 6–7). */
export function assessDraft(draft: ProposalDraft, ctx: AssessmentContext): Assessment {
  const validation = validateDraft(draft, ctx);
  const missingSlots = mergeSlots(
    computeMissingSlots(draft.kind, draft.payload),
    validation.missingSlots,
  );
  return { status: statusFromSlots(missingSlots), missingSlots, warnings: validation.warnings };
}
