import "server-only";

import { sql } from "drizzle-orm";

import { getDb, type Db } from "@/server/db/client";

export interface Health {
  status: "ok" | "degraded";
  version: string;
  commit: string | null;
  db: "ok" | "error";
}

export const DB_PING_TIMEOUT_MS = 3000;

export async function pingDatabase(db: Db = getDb()): Promise<void> {
  await db.execute(sql`select 1`);
}

/** No user data and no error details: the route is public. */
export async function getHealth(ping: () => Promise<void> = () => pingDatabase()): Promise<Health> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), DB_PING_TIMEOUT_MS);
  });
  const db = await Promise.race([ping(), timeout]).then(
    () => "ok" as const,
    () => "error" as const,
  );
  clearTimeout(timer);
  return {
    status: db === "ok" ? "ok" : "degraded",
    version: process.env.LTS_VERSION ?? "dev",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    db,
  };
}
