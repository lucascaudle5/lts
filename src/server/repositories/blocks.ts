import "server-only";

import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";

import { getDb, type Db } from "@/server/db/client";
import { scheduleBlocks } from "@/server/db/schema";

export type BlockRow = Pick<
  typeof scheduleBlocks.$inferSelect,
  "id" | "title" | "kind" | "startsAt" | "endsAt" | "fixed"
>;

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
    })
    .from(scheduleBlocks)
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
