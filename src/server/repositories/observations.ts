import "server-only";

import { and, asc, eq } from "drizzle-orm";

import type { IsoDate } from "@/contracts/common";
import { getDb, type Db } from "@/server/db/client";
import { captures, observations, proposalItems } from "@/server/db/schema";

export type ObservationRow = Pick<
  typeof observations.$inferSelect,
  "id" | "category" | "valueText" | "occurredOn"
> & { captureId?: string | null; captureDate?: IsoDate | null };

/** What the user reported for one calendar day, in the order they reported it. */
export async function listObservationsOn(
  userId: string,
  date: IsoDate,
  db: Db = getDb(),
): Promise<ObservationRow[]> {
  return db
    .select({
      id: observations.id,
      category: observations.category,
      valueText: observations.valueText,
      occurredOn: observations.occurredOn,
      captureId: captures.id,
      captureDate: captures.referenceDate,
    })
    .from(observations)
    .leftJoin(
      proposalItems,
      and(eq(observations.originItemId, proposalItems.id), eq(proposalItems.userId, userId)),
    )
    .leftJoin(captures, and(eq(proposalItems.captureId, captures.id), eq(captures.userId, userId)))
    .where(and(eq(observations.userId, userId), eq(observations.occurredOn, date)))
    .orderBy(asc(observations.createdAt), asc(observations.id));
}
