import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import type { WorkspaceData } from "@/contracts/life";
import { todayInTimezone, instantToLocal } from "@/domain/dates";
import { getDb, type Db } from "@/server/db/client";
import { captures, observations, profiles, proposalItems } from "@/server/db/schema";
import {
  listLifeRecords,
  listHistory,
  listSchedule,
  listArchivedTasks,
} from "@/server/repositories/life";

export async function getWorkspace(
  userId: string,
  timezone: string,
  db: Db = getDb(),
): Promise<WorkspaceData> {
  const [records, history, blocks, tasks, reported, inbox, profile] = await Promise.all([
    listLifeRecords(userId, db),
    listHistory(userId, db),
    listSchedule(userId, db),
    listArchivedTasks(userId, db),
    db
      .select({
        id: observations.id,
        category: observations.category,
        valueText: observations.valueText,
        occurredOn: observations.occurredOn,
        deletedAt: observations.deletedAt,
      })
      .from(observations)
      .where(eq(observations.userId, userId))
      .orderBy(desc(observations.createdAt))
      .limit(500),
    db
      .select({
        id: captures.id,
        text: captures.text,
        date: captures.referenceDate,
        pending: sql<number>`count(${proposalItems.id}) filter (where ${proposalItems.status} in ('ready', 'needs_input'))::int`,
      })
      .from(captures)
      .leftJoin(
        proposalItems,
        and(eq(proposalItems.captureId, captures.id), eq(proposalItems.userId, userId)),
      )
      .where(eq(captures.userId, userId))
      .groupBy(captures.id)
      .orderBy(desc(captures.createdAt))
      .limit(100),
    db
      .select({ authority: profiles.aiAuthority })
      .from(profiles)
      .where(eq(profiles.userId, userId)),
  ]);
  return {
    today: todayInTimezone(new Date(), timezone),
    timezone,
    authority: profile[0]?.authority === "allow_explicit" ? "allow_explicit" : "ask",
    records,
    history,
    observations: reported.map(({ deletedAt, ...row }) => ({
      ...row,
      archivedAt: deletedAt?.toISOString() ?? null,
    })),
    captures: inbox,
    tasks: tasks.map((task) => ({
      ...task,
      archivedAt: task.deletedAt?.toISOString() ?? null,
      updatedAt: task.updatedAt.toISOString(),
    })),
    schedule: blocks.map((block) => ({
      id: block.id,
      title: block.title,
      kind: block.kind,
      ...instantToLocal(block.startsAt, timezone),
      start: instantToLocal(block.startsAt, timezone).time,
      end: instantToLocal(block.endsAt, timezone).time,
      fixed: block.fixed,
      seriesId: block.seriesId,
      archivedAt: block.deletedAt?.toISOString() ?? null,
      updatedAt: block.updatedAt.toISOString(),
    })),
  };
}
