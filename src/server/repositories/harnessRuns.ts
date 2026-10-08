import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb, type Db } from "@/server/db/client";
import { harnessRuns } from "@/server/db/schema";

export async function getLatestHarnessRunForCapture(
  userId: string,
  captureId: string,
  db: Db = getDb(),
) {
  const [row] = await db
    .select({
      provider: harnessRuns.provider,
      model: harnessRuns.model,
      promptVersion: harnessRuns.promptVersion,
      status: harnessRuns.status,
    })
    .from(harnessRuns)
    .where(and(eq(harnessRuns.userId, userId), eq(harnessRuns.captureId, captureId)))
    .orderBy(desc(harnessRuns.createdAt))
    .limit(1);
  return row ?? null;
}
