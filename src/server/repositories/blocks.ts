import "server-only";

import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";

import type { IsoDate } from "@/contracts/common";
import { getDb, type Db } from "@/server/db/client";
import { captures, proposalItems, scheduleBlocks } from "@/server/db/schema";

export interface BlockRow {
  id: string;
  title: string;
  kind: typeof scheduleBlocks.$inferSelect.kind;
  startsAt: Date;
  endsAt: Date;
  fixed: boolean;
  captureId?: string | null;
  captureDate?: IsoDate | null;
}

/** The user's live blocks starting in `[from, to)`, earliest first. */
export async function listBlocksStartingBetween(
  userId: string,
  range: { from: Date; to: Date },
  db: Db = getDb(),
): Promise<BlockRow[]> {
  return db
    .select({
      id: scheduleBlocks.id,
      title: scheduleBlocks.title,
      kind: scheduleBlocks.kind,
      startsAt: scheduleBlocks.startsAt,
      endsAt: scheduleBlocks.endsAt,
      fixed: scheduleBlocks.fixed,
      captureId: captures.id,
      captureDate: captures.referenceDate,
    })
    .from(scheduleBlocks)
    .leftJoin(
      proposalItems,
      and(eq(scheduleBlocks.originItemId, proposalItems.id), eq(proposalItems.userId, userId)),
    )
    .leftJoin(captures, and(eq(proposalItems.captureId, captures.id), eq(captures.userId, userId)))
    .where(
      and(
        eq(scheduleBlocks.userId, userId),
        isNull(scheduleBlocks.deletedAt),
        gte(scheduleBlocks.startsAt, range.from),
        lt(scheduleBlocks.startsAt, range.to),
      ),
    )
    .orderBy(asc(scheduleBlocks.startsAt), asc(scheduleBlocks.endsAt), asc(scheduleBlocks.id));
}
