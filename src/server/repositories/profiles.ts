import "server-only";

import { eq } from "drizzle-orm";

import { getDb, type Db } from "@/server/db/client";
import { profiles } from "@/server/db/schema";

export type ProfileRow = Pick<typeof profiles.$inferSelect, "userId" | "timezone">;

export async function getProfile(userId: string, db: Db = getDb()): Promise<ProfileRow | null> {
  const [row] = await db
    .select({ userId: profiles.userId, timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row ?? null;
}
