import "server-only";

import { desc, eq } from "drizzle-orm";

import { LifeRecord, type LifeRow } from "@/contracts/life";
import { getDb, type Db } from "@/server/db/client";
import {
  lifeRecords,
  changeLog,
  scheduleBlocks,
  tasks,
  observations,
  captures,
  proposalItems,
  profiles,
} from "@/server/db/schema";

export async function listLifeRecords(userId: string, db: Db = getDb()): Promise<LifeRow[]> {
  const rows = await db
    .select()
    .from(lifeRecords)
    .where(eq(lifeRecords.userId, userId))
    .orderBy(desc(lifeRecords.createdAt));
  return rows.map((row) => ({
    id: row.id,
    data: LifeRecord.parse(row.data),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listHistory(userId: string, db: Db = getDb()) {
  const rows = await db
    .select()
    .from(changeLog)
    .where(eq(changeLog.userId, userId))
    .orderBy(desc(changeLog.sequence))
    .limit(1000);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function listSchedule(userId: string, db: Db = getDb()) {
  return db
    .select()
    .from(scheduleBlocks)
    .where(eq(scheduleBlocks.userId, userId))
    .orderBy(desc(scheduleBlocks.startsAt));
}

export async function listArchivedTasks(userId: string, db: Db = getDb()) {
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt));
}

export async function exportUserData(userId: string, db: Db = getDb()) {
  // Each collection is explicitly scoped; raw model payloads and credentials are excluded.
  return db.transaction(
    async (tx) => {
      const profile = await tx.select().from(profiles).where(eq(profiles.userId, userId));
      const records = await tx.select().from(lifeRecords).where(eq(lifeRecords.userId, userId));
      const blocks = await tx
        .select()
        .from(scheduleBlocks)
        .where(eq(scheduleBlocks.userId, userId));
      const taskRows = await tx.select().from(tasks).where(eq(tasks.userId, userId));
      const observationRows = await tx
        .select()
        .from(observations)
        .where(eq(observations.userId, userId));
      const captureRows = await tx.select().from(captures).where(eq(captures.userId, userId));
      const proposals = await tx
        .select()
        .from(proposalItems)
        .where(eq(proposalItems.userId, userId));
      const changes = await tx.select().from(changeLog).where(eq(changeLog.userId, userId));
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        profile,
        records,
        blocks,
        tasks: taskRows,
        observations: observationRows,
        captures: captureRows,
        proposals,
        changes,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
