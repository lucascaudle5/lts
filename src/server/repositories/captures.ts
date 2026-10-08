import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb, type Db } from "@/server/db/client";
import { captures } from "@/server/db/schema";

export type CaptureRow = Pick<
  typeof captures.$inferSelect,
  "id" | "text" | "referenceDate" | "timezone" | "safetyStop" | "createdAt"
>;

export async function getCapture(
  userId: string,
  captureId: string,
  db: Db = getDb(),
): Promise<CaptureRow | null> {
  const [row] = await db
    .select({
      id: captures.id,
      text: captures.text,
      referenceDate: captures.referenceDate,
      timezone: captures.timezone,
      safetyStop: captures.safetyStop,
      createdAt: captures.createdAt,
    })
    .from(captures)
    .where(and(eq(captures.userId, userId), eq(captures.id, captureId)))
    .limit(1);
  return row ?? null;
}
