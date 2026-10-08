import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { Uuid } from "@/contracts/common";
import { getDb, type Db } from "@/server/db/client";
import { proposalItems } from "@/server/db/schema";

/** Rejection changes proposal bookkeeping only; it never writes domain rows. */
export async function rejectItems(
  userId: string,
  itemIds: readonly string[],
  db: Db = getDb(),
): Promise<string[]> {
  const ownerId = Uuid.parse(userId);
  const ids = [...new Set(itemIds.map((id) => Uuid.parse(id)))];
  if (ids.length === 0) throw new Error("Choose at least one proposal to reject");

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: proposalItems.id, status: proposalItems.status })
      .from(proposalItems)
      .where(and(eq(proposalItems.userId, ownerId), inArray(proposalItems.id, ids)))
      .for("update");
    if (rows.length !== ids.length) throw new Error("One or more proposals are unavailable");
    if (rows.some((row) => row.status !== "ready" && row.status !== "needs_input")) {
      throw new Error("One or more proposals can no longer be rejected");
    }
    await tx
      .update(proposalItems)
      .set({ status: "rejected", decidedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(proposalItems.userId, ownerId), inArray(proposalItems.id, ids)));
    return ids;
  });
}
