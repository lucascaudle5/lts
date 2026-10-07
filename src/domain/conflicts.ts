import type { HhMm, IsoDate } from "@/contracts/common";

export interface BlockSpan {
  date: IsoDate;
  start: HhMm;
  end: HhMm;
}

export interface ExistingBlock extends BlockSpan {
  id: string;
  title: string;
  fixed: boolean;
}

export interface ExistingTask {
  id: string;
  title: string;
}

/** Existing fixed blocks that overlap `candidate`. Touching ends (2–3 and 3–4) do not overlap. */
export function findFixedBlockConflicts(
  candidate: BlockSpan,
  existing: readonly ExistingBlock[],
): ExistingBlock[] {
  return existing.filter(
    (block) =>
      block.fixed &&
      block.date === candidate.date &&
      candidate.start < block.end &&
      block.start < candidate.end,
  );
}

export function normalizeTaskTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(buy|get|need|do)\s+/, "");
}

export function findDuplicateTasks(
  title: string,
  openTasks: readonly ExistingTask[],
): ExistingTask[] {
  const key = normalizeTaskTitle(title);
  if (!key) return [];
  return openTasks.filter((task) => normalizeTaskTitle(task.title) === key);
}
