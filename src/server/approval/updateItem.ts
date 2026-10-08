import "server-only";

import { and, eq } from "drizzle-orm";

import { Uuid, type IsoDate } from "@/contracts/common";
import { ProposalDraft } from "@/contracts/proposals";
import { checkDraftSafety } from "@/domain/safety";
import { assessProposalDraft } from "@/server/compiler/assessment";
import { getDb, type Db } from "@/server/db/client";
import { captures, proposalItems } from "@/server/db/schema";

export async function updateProposalItem(
  userId: string,
  itemId: string,
  input: unknown,
  db: Db = getDb(),
) {
  const ownerId = Uuid.parse(userId);
  const id = Uuid.parse(itemId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ item: proposalItems, capture: captures })
      .from(proposalItems)
      .innerJoin(captures, eq(proposalItems.captureId, captures.id))
      .where(
        and(
          eq(proposalItems.id, id),
          eq(proposalItems.userId, ownerId),
          eq(captures.userId, ownerId),
        ),
      )
      .for("update", { of: proposalItems })
      .limit(1);
    if (!row) throw new Error("Proposal not found");
    if (row.item.status !== "ready" && row.item.status !== "needs_input") {
      throw new Error("This proposal can no longer be edited");
    }

    const draft = ProposalDraft.parse({
      kind: row.item.kind,
      quote: row.item.quote,
      confidence: row.item.confidence,
      payload: input,
    });
    if (checkDraftSafety(draft, row.capture.text).length > 0) {
      throw new Error("This edit does not match the capture safely");
    }
    const assessment = await assessProposalDraft(
      ownerId,
      draft,
      row.capture.referenceDate as IsoDate,
      row.capture.timezone,
      tx as unknown as Db,
    );

    const [updated] = await tx
      .update(proposalItems)
      .set({
        payload: draft.payload,
        status: assessment.status,
        missingSlots: assessment.missingSlots,
        warnings: assessment.warnings,
        updatedAt: new Date(),
      })
      .where(and(eq(proposalItems.id, id), eq(proposalItems.userId, ownerId)))
      .returning({ id: proposalItems.id });
    if (!updated) throw new Error("Proposal could not be updated");
    return { id: updated.id, status: assessment.status, missingSlots: assessment.missingSlots };
  });
}
