import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { ProposalItem } from "@/contracts/proposals";
import { getDb, type Db } from "@/server/db/client";
import { proposalItems } from "@/server/db/schema";

export async function listProposalItemsForCapture(
  userId: string,
  captureId: string,
  db: Db = getDb(),
) {
  const rows = await db
    .select()
    .from(proposalItems)
    .where(and(eq(proposalItems.userId, userId), eq(proposalItems.captureId, captureId)))
    .orderBy(asc(proposalItems.createdAt), asc(proposalItems.id));

  return rows.map((row) =>
    ProposalItem.parse({
      id: row.id,
      kind: row.kind,
      payload: row.payload,
      status: row.status,
      missingSlots: row.missingSlots,
      warnings: row.warnings,
      provenance: {
        source: row.source,
        ...(row.model ? { model: row.model } : {}),
        ...(row.promptVersion ? { promptVersion: row.promptVersion } : {}),
        ...(row.harnessRunId ? { harnessRunId: row.harnessRunId } : {}),
        quote: row.quote,
        confidence: row.confidence,
      },
    }),
  );
}
