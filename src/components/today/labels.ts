import type { BlockKind, ObservationCategory, TaskKind } from "@/contracts/common";

export const BLOCK_KIND_LABEL: Record<BlockKind, string> = {
  work: "Work",
  class: "Class",
  exam: "Exam",
  fitness: "Fitness",
  meal: "Meal",
  focus: "Focus",
  personal: "Personal",
};

/**
 * Block-kind hues as room tokens: --k is the edge and --k-soft the fill. Exams use gold, never red.
 * Fixed blocks are solid, flexible ones dashed.
 */
export const BLOCK_KIND_ACCENT: Record<BlockKind, string> = {
  work: "[--k:var(--blue)] [--k-soft:var(--blue-soft)]",
  class: "[--k:var(--purple)] [--k-soft:var(--purple-soft)]",
  exam: "[--k:var(--gold)] [--k-soft:var(--gold-soft)]",
  fitness: "[--k:var(--green)] [--k-soft:var(--green-soft)]",
  meal: "[--k:var(--lime)] [--k-soft:var(--lime-soft)]",
  focus: "[--k:var(--ink-soft)] [--k-soft:var(--surface-3)]",
  personal: "[--k:var(--line-strong)] [--k-soft:var(--surface-2)]",
};

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  errand: "Errand",
  assignment: "Assignment",
  exam: "Exam",
  chore: "Chore",
  other: "Task",
};

export const OBSERVATION_CATEGORY_LABEL: Record<ObservationCategory, string> = {
  energy: "Energy",
  sleep: "Sleep",
  stress: "Stress",
  capacity: "Capacity",
  note: "Note",
};
