import "server-only";

import { getDb, type Db } from "@/server/db/client";
import { runMutations } from "@/server/mutations/runMutations";

/** Approval intentionally has no write path of its own; all writes belong to runMutations. */
export function approveItems(userId: string, itemIds: readonly string[], db: Db = getDb()) {
  return runMutations(userId, { origin: "proposal", itemIds }, db);
}
