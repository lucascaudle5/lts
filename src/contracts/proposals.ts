import { z } from "zod";

import { ObservationRecord, ScheduleBlockCreate, TaskCreate } from "./commands";
import { Confidence, MissingSlot, Uuid, Warning } from "./common";

export const ProposalStatus = z.enum([
  "needs_input",
  "ready",
  "approved",
  "rejected",
  "applied",
  "failed",
]);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

export const ProvenanceSource = z.enum(["model", "parser", "user"]);
export type ProvenanceSource = z.infer<typeof ProvenanceSource>;

export const Provenance = z.object({
  source: ProvenanceSource,
  model: z.string().min(1).optional(),
  promptVersion: z.string().min(1).optional(),
  harnessRunId: Uuid.optional(),
  /** Exact span of the capture text this item came from. */
  quote: z.string().min(1),
  confidence: Confidence,
});
export type Provenance = z.infer<typeof Provenance>;

/** Drafts carry only what the interpreter said; command defaults apply at approval. */
export const ScheduleBlockCreateDraft = ScheduleBlockCreate.extend({
  fixed: z.boolean(),
}).partial();
export const TaskCreateDraft = TaskCreate.partial();
export const ObservationRecordDraft = ObservationRecord.partial();

const itemBase = {
  id: Uuid,
  status: ProposalStatus,
  missingSlots: z.array(MissingSlot),
  warnings: z.array(Warning),
  provenance: Provenance,
};

/** One proposed change. The payload stays partial until every required slot is filled. */
export const ProposalItem = z.discriminatedUnion("kind", [
  z.object({
    ...itemBase,
    kind: z.literal("schedule_block.create"),
    payload: ScheduleBlockCreateDraft,
  }),
  z.object({ ...itemBase, kind: z.literal("task.create"), payload: TaskCreateDraft }),
  z.object({
    ...itemBase,
    kind: z.literal("observation.record"),
    payload: ObservationRecordDraft,
  }),
]);
export type ProposalItem = z.infer<typeof ProposalItem>;

const draftBase = {
  quote: z.string().min(1),
  confidence: Confidence,
};

/** What an interpreter (model or parser) returns per item, before the pipeline enriches it. */
export const ProposalDraft = z.discriminatedUnion("kind", [
  z.object({
    ...draftBase,
    kind: z.literal("schedule_block.create"),
    payload: ScheduleBlockCreateDraft,
  }),
  z.object({ ...draftBase, kind: z.literal("task.create"), payload: TaskCreateDraft }),
  z.object({
    ...draftBase,
    kind: z.literal("observation.record"),
    payload: ObservationRecordDraft,
  }),
]);
export type ProposalDraft = z.infer<typeof ProposalDraft>;

export const MAX_PROPOSALS_PER_CAPTURE = 20;

/** The model-facing `submit_proposals` output: the only way an interpreter returns changes. */
export const SubmitProposals = z.object({
  items: z.array(ProposalDraft).max(MAX_PROPOSALS_PER_CAPTURE),
});
export type SubmitProposals = z.infer<typeof SubmitProposals>;
