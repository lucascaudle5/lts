import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { MAX_OPEN_TASKS } from "@/contracts/tools";
import { getDb, type Db } from "@/server/db/client";
import { tasks } from "@/server/db/schema";

export type TaskRow = Pick<typeof tasks.$inferSelect, "id" | "title" | "kind" | "dueOn">;

/** The user's open tasks: dated ones first (soonest due), then undated, oldest first. */
export async function listOpenTasks(
  userId: string,
  options: { limit?: number } = {},
  db: Db = getDb(),
): Promise<TaskRow[]> {
  const limit = Math.min(Math.max(options.limit ?? MAX_OPEN_TASKS, 1), MAX_OPEN_TASKS);
  return db
    .select({ id: tasks.id, title: tasks.title, kind: tasks.kind, dueOn: tasks.dueOn })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "open")))
    .orderBy(sql`${tasks.dueOn} asc nulls last`, asc(tasks.createdAt), asc(tasks.id))
    .limit(limit);
}
