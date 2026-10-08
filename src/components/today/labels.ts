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

/** Left-edge accent per block kind; fixed blocks are solid, flexible ones dashed. */
export const BLOCK_KIND_ACCENT: Record<BlockKind, string> = {
  work: "border-l-amber-500",
  class: "border-l-sky-500",
  exam: "border-l-rose-500",
  fitness: "border-l-emerald-500",
  meal: "border-l-orange-400",
  focus: "border-l-violet-500",
  personal: "border-l-slate-400",
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
