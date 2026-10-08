import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { TaskDetails } from "@/contracts/commands";

import { MAX_OPEN_TASKS } from "@/contracts/tools";
import { getDb, type Db } from "@/server/db/client";
import { captures, proposalItems, tasks } from "@/server/db/schema";

export interface TaskRow {
  id: string;
  title: string;
  kind: typeof tasks.$inferSelect.kind;
  dueOn: string | null;
  priority: typeof tasks.$inferSelect.priority;
  status: typeof tasks.$inferSelect.status;
  notes: string | null;
  details?: TaskDetails;
  captureId?: string | null;
  captureDate?: string | null;
}

const taskSelection = {
  id: tasks.id,
  title: tasks.title,
  kind: tasks.kind,
  dueOn: tasks.dueOn,
  priority: tasks.priority,
  status: tasks.status,
  notes: tasks.notes,
  details: tasks.details,
  captureId: captures.id,
  captureDate: captures.referenceDate,
};

function withProvenance(userId: string, db: Db) {
  return db
    .select(taskSelection)
    .from(tasks)
    .leftJoin(
      proposalItems,
      and(eq(tasks.originItemId, proposalItems.id), eq(proposalItems.userId, userId)),
    )
    .leftJoin(captures, and(eq(proposalItems.captureId, captures.id), eq(captures.userId, userId)));
}

/** The user's open tasks: dated ones first (soonest due), then undated, oldest first. */
export async function listOpenTasks(
  userId: string,
  options: { limit?: number } = {},
  db: Db = getDb(),
): Promise<TaskRow[]> {
  const limit = Math.min(Math.max(options.limit ?? MAX_OPEN_TASKS, 1), MAX_OPEN_TASKS);
  return withProvenance(userId, db)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "open"), isNull(tasks.deletedAt)))
    .orderBy(sql`${tasks.dueOn} asc nulls last`, asc(tasks.createdAt), asc(tasks.id))
    .limit(limit);
}

/** All of the user's tasks, active items first and due dates earliest first. */
export async function listTasks(userId: string, db: Db = getDb()): Promise<TaskRow[]> {
  return withProvenance(userId, db)
    .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .orderBy(
      sql`case ${tasks.status} when 'open' then 0 when 'parked' then 1 else 2 end`,
      sql`${tasks.dueOn} asc nulls last`,
      asc(tasks.createdAt),
      asc(tasks.id),
    );
}

export async function countOpenTasks(userId: string, db: Db = getDb()): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "open"), isNull(tasks.deletedAt)));
  return row?.count ?? 0;
}
