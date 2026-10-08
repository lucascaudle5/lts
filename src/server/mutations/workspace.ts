import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, ne } from "drizzle-orm";

import { LifeRecord, type WorkspaceOperation, type UserBackup } from "@/contracts/life";
import { recordLinks, repeatDates, nextBillDate } from "@/domain/life";
import { instantToLocal, localDateTimeToInstant } from "@/domain/dates";
import type { DbTransaction } from "@/server/db/client";
import {
  changeLog,
  lifeRecords,
  observations,
  profiles,
  scheduleBlocks,
  tasks,
} from "@/server/db/schema";

type Entity = "life_record" | "schedule_block" | "task" | "profile" | "observation";
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

async function audit(
  tx: DbTransaction,
  userId: string,
  mutationId: string,
  entityType: Entity,
  entityId: string,
  before: unknown,
  after: unknown,
  origin: "manual" | "undo" = "manual",
) {
  await tx.insert(changeLog).values({
    userId,
    mutationId,
    entityType,
    entityId,
    before: json(before),
    after: json(after),
    action: before ? "update" : "create",
    actor: "user",
    origin,
  });
  return { proposalItemId: null, entityType, entityId };
}

export async function assertTaskProject(
  tx: DbTransaction,
  userId: string,
  projectId?: string | null,
) {
  if (!projectId) return;
  const [row] = await tx
    .select()
    .from(lifeRecords)
    .where(
      and(
        eq(lifeRecords.id, projectId),
        eq(lifeRecords.userId, userId),
        eq(lifeRecords.type, "project"),
        isNull(lifeRecords.archivedAt),
      ),
    );
  if (!row) throw new Error("Project is unavailable");
}

async function assertLinks(tx: DbTransaction, userId: string, data: LifeRecord) {
  for (const link of recordLinks(data)) {
    const [row] = await tx
      .select()
      .from(lifeRecords)
      .where(and(eq(lifeRecords.id, link.id), eq(lifeRecords.userId, userId)));
    if (
      row &&
      (!link.type || row.type === link.type) &&
      (data.type === "review" || !row.archivedAt)
    )
      continue;
    if (data.type === "review") {
      const [task] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, link.id), eq(tasks.userId, userId)));
      const [block] = await tx
        .select({ id: scheduleBlocks.id })
        .from(scheduleBlocks)
        .where(and(eq(scheduleBlocks.id, link.id), eq(scheduleBlocks.userId, userId)));
      const [observation] = await tx
        .select({ id: observations.id })
        .from(observations)
        .where(and(eq(observations.id, link.id), eq(observations.userId, userId)));
      if (task || block || observation) continue;
    }
    throw new Error("A linked record is unavailable");
  }
}

export async function applyWorkspace(
  tx: DbTransaction,
  userId: string,
  operation: WorkspaceOperation,
  timezone: string,
  mutationId: string,
) {
  const result: Array<{ proposalItemId: null; entityType: Entity; entityId: string }> = [];
  if (operation.op === "record.save") {
    let data = operation.record;
    await assertLinks(tx, userId, data);
    if (data.type === "project" && data.frontier && data.status === "active") {
      const projects = await tx
        .select()
        .from(lifeRecords)
        .where(
          and(
            eq(lifeRecords.userId, userId),
            eq(lifeRecords.type, "project"),
            isNull(lifeRecords.archivedAt),
          ),
        );
      if (
        projects.filter(
          (p) =>
            p.id !== operation.id &&
            p.data.type === "project" &&
            p.data.frontier &&
            p.data.status === "active",
        ).length >= 3
      )
        throw new Error("Choose up to three active frontiers. Park one before adding another.");
    }
    if (data.type === "habit_log") {
      const [habit] = await tx
        .select()
        .from(lifeRecords)
        .where(and(eq(lifeRecords.id, data.habitId), eq(lifeRecords.userId, userId)));
      const definition = LifeRecord.parse(habit.data);
      if (definition.type !== "habit") throw new Error("Habit unavailable");
      if (data.outcome === "done" && data.value < definition.target)
        data = { ...data, outcome: "partial" };
    }
    if (data.type === "routine_run") {
      const [routine] = await tx
        .select()
        .from(lifeRecords)
        .where(and(eq(lifeRecords.id, data.routineId), eq(lifeRecords.userId, userId)));
      const definition = LifeRecord.parse(routine.data);
      if (definition.type !== "routine") throw new Error("Routine unavailable");
      const allowedSteps = definition[data.variant];
      if (data.completedSteps.some((step) => !allowedSteps.includes(step)))
        throw new Error("Choose steps from this routine variant");
      if (
        data.outcome === "done" &&
        !allowedSteps.every((step) => data.completedSteps.includes(step))
      )
        throw new Error("Finish this variant's steps, or record partial completion");
    }
    let recordId = operation.id;
    // A daily check-in edits the day's existing record rather than creating double counts.
    if (!recordId && ["habit_log", "routine_run", "nutrition_targets"].includes(data.type)) {
      const existing = await tx
        .select()
        .from(lifeRecords)
        .where(
          and(
            eq(lifeRecords.userId, userId),
            eq(lifeRecords.type, data.type),
            isNull(lifeRecords.archivedAt),
          ),
        );
      const candidate = existing.find(
        (r) =>
          data.type === "nutrition_targets" ||
          (data.type === "habit_log" &&
            r.data.type === "habit_log" &&
            r.data.habitId === data.habitId &&
            r.data.date === data.date) ||
          (data.type === "routine_run" &&
            r.data.type === "routine_run" &&
            r.data.routineId === data.routineId &&
            r.data.date === data.date),
      );
      recordId = candidate?.id;
    }
    const [before] = recordId
      ? await tx
          .select()
          .from(lifeRecords)
          .where(and(eq(lifeRecords.id, recordId), eq(lifeRecords.userId, userId)))
          .for("update")
      : [];
    if (recordId && (!before || before.archivedAt))
      throw new Error("Record unavailable; restore it from Archive first");
    if (before && before.type !== data.type) throw new Error("A record's type cannot change");
    if (
      before &&
      operation.expectedUpdatedAt &&
      before.updatedAt.toISOString() !== operation.expectedUpdatedAt
    )
      throw new Error("This record changed. Refresh before saving again.");
    const [after] = before
      ? await tx
          .update(lifeRecords)
          .set({ data, updatedAt: new Date() })
          .where(and(eq(lifeRecords.id, before.id), eq(lifeRecords.userId, userId)))
          .returning()
      : await tx.insert(lifeRecords).values({ userId, type: data.type, data }).returning();
    result.push(
      await audit(tx, userId, mutationId, "life_record", after.id, before ?? null, after),
    );
  } else if (operation.op === "observation.save" || operation.op === "observation.archive") {
    const [before] = await tx
      .select()
      .from(observations)
      .where(and(eq(observations.id, operation.id), eq(observations.userId, userId)))
      .for("update");
    if (!before || (operation.op === "observation.save" && before.deletedAt))
      throw new Error("Observation unavailable; restore it first");
    const [after] = await tx
      .update(observations)
      .set(
        operation.op === "observation.save"
          ? {
              category: operation.category,
              valueText: operation.valueText,
              valueNum: null,
              occurredOn: operation.occurredOn,
              quote: operation.valueText,
              source: "manual_entry",
              sensitivity: operation.category === "note" ? "normal" : "health",
            }
          : { deletedAt: operation.archive ? new Date() : null },
      )
      .where(and(eq(observations.id, before.id), eq(observations.userId, userId)))
      .returning();
    result.push(await audit(tx, userId, mutationId, "observation", before.id, before, after));
  } else if (operation.op === "money.pay") {
    const [before] = await tx
      .select()
      .from(lifeRecords)
      .where(
        and(
          eq(lifeRecords.id, operation.id),
          eq(lifeRecords.userId, userId),
          isNull(lifeRecords.archivedAt),
        ),
      )
      .for("update");
    if (!before || before.data.type !== "money" || before.data.direction !== "bill")
      throw new Error("Bill unavailable");
    if (before.data.paid) return result;
    const seriesId = before.data.seriesId ?? randomUUID();
    result.push(
      ...(await applyWorkspace(
        tx,
        userId,
        { op: "record.save", id: before.id, record: { ...before.data, paid: true, seriesId } },
        timezone,
        mutationId,
      )),
    );
    if (before.data.recurrence !== "none")
      result.push(
        ...(await applyWorkspace(
          tx,
          userId,
          {
            op: "record.save",
            record: {
              ...before.data,
              paid: false,
              date: nextBillDate(before.data.date, before.data.recurrence),
              seriesId,
            },
          },
          timezone,
          mutationId,
        )),
      );
  } else if (operation.op === "record.collection") {
    const [before] = await tx
      .select()
      .from(lifeRecords)
      .where(and(eq(lifeRecords.id, operation.id), eq(lifeRecords.userId, userId)))
      .for("update");
    if (!before) throw new Error("Record unavailable");
    const [after] = await tx
      .update(lifeRecords)
      .set({ data: { ...before.data, collection: operation.collection }, updatedAt: new Date() })
      .where(and(eq(lifeRecords.id, before.id), eq(lifeRecords.userId, userId)))
      .returning();
    result.push(await audit(tx, userId, mutationId, "life_record", before.id, before, after));
  } else if (operation.op === "record.archive") {
    const [before] = await tx
      .select()
      .from(lifeRecords)
      .where(and(eq(lifeRecords.id, operation.id), eq(lifeRecords.userId, userId)))
      .for("update");
    if (!before) throw new Error("Record unavailable");
    if (!operation.archive) await assertLinks(tx, userId, LifeRecord.parse(before.data));
    const [after] = await tx
      .update(lifeRecords)
      .set({ archivedAt: operation.archive ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(lifeRecords.id, before.id), eq(lifeRecords.userId, userId)))
      .returning();
    result.push(await audit(tx, userId, mutationId, "life_record", before.id, before, after));
  } else if (operation.op === "schedule.save") {
    if (operation.id && operation.repeat)
      throw new Error("Edit an occurrence individually; create a new series to repeat");
    const [before] = operation.id
      ? await tx
          .select()
          .from(scheduleBlocks)
          .where(and(eq(scheduleBlocks.id, operation.id), eq(scheduleBlocks.userId, userId)))
          .for("update")
      : [];
    if (operation.id && (!before || before.deletedAt)) throw new Error("Block unavailable");
    if (
      before &&
      operation.expectedUpdatedAt &&
      before.updatedAt.toISOString() !== operation.expectedUpdatedAt
    )
      throw new Error("This block changed. Refresh before saving again.");
    const block = operation.block;
    if (block.end <= block.start)
      throw new Error(
        "The end time must follow the start time; split overnight blocks at midnight",
      );
    const dates = operation.repeat
      ? repeatDates(block.date, operation.repeat.until, operation.repeat.days)
      : [block.date];
    const seriesId = operation.repeat ? randomUUID() : (before?.seriesId ?? null);
    for (const date of dates) {
      const startsAt = localDateTimeToInstant(date, block.start, timezone);
      const endsAt = localDateTimeToInstant(date, block.end, timezone);
      if (
        instantToLocal(startsAt, timezone).time !== block.start ||
        instantToLocal(endsAt, timezone).time !== block.end ||
        endsAt <= startsAt
      )
        throw new Error("That time does not exist in your timezone on this date");
      if (!operation.allowOverlap) {
        const conflicts = await tx
          .select({ id: scheduleBlocks.id })
          .from(scheduleBlocks)
          .where(
            and(
              eq(scheduleBlocks.userId, userId),
              isNull(scheduleBlocks.deletedAt),
              lt(scheduleBlocks.startsAt, endsAt),
              gt(scheduleBlocks.endsAt, startsAt),
              ...(before ? [ne(scheduleBlocks.id, before.id)] : []),
            ),
          )
          .limit(1);
        if (conflicts.length)
          throw new Error(
            `A block overlaps on ${date}. Adjust the times or explicitly allow overlap.`,
          );
      }
      const values = {
        title: block.title,
        kind: block.blockKind,
        startsAt,
        endsAt,
        fixed: block.fixed,
        seriesId,
        updatedAt: new Date(),
      };
      const [after] = before
        ? await tx
            .update(scheduleBlocks)
            .set(values)
            .where(and(eq(scheduleBlocks.id, before.id), eq(scheduleBlocks.userId, userId)))
            .returning()
        : await tx
            .insert(scheduleBlocks)
            .values({ ...values, userId, origin: "manual" })
            .returning();
      result.push(
        await audit(tx, userId, mutationId, "schedule_block", after.id, before ?? null, after),
      );
    }
  } else if (operation.op === "schedule.archive") {
    const [block] = await tx
      .select()
      .from(scheduleBlocks)
      .where(and(eq(scheduleBlocks.id, operation.id), eq(scheduleBlocks.userId, userId)))
      .for("update");
    if (!block) throw new Error("Block unavailable");
    const rows =
      operation.series && block.seriesId
        ? await tx
            .select()
            .from(scheduleBlocks)
            .where(
              and(eq(scheduleBlocks.seriesId, block.seriesId), eq(scheduleBlocks.userId, userId)),
            )
            .for("update")
        : [block];
    for (const before of rows) {
      const [after] = await tx
        .update(scheduleBlocks)
        .set({ deletedAt: operation.archive ? new Date() : null, updatedAt: new Date() })
        .where(and(eq(scheduleBlocks.id, before.id), eq(scheduleBlocks.userId, userId)))
        .returning();
      result.push(await audit(tx, userId, mutationId, "schedule_block", before.id, before, after));
    }
  } else if (operation.op === "task.archive") {
    const [before] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, operation.id), eq(tasks.userId, userId)))
      .for("update");
    if (!before) throw new Error("Task unavailable");
    const [after] = await tx
      .update(tasks)
      .set({ deletedAt: operation.archive ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(tasks.id, before.id), eq(tasks.userId, userId)))
      .returning();
    result.push(await audit(tx, userId, mutationId, "task", before.id, before, after));
  } else if (operation.op === "profile.save") {
    const [before] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .for("update");
    if (!before) throw new Error("Profile unavailable");
    const [after] = await tx
      .update(profiles)
      .set({
        timezone: operation.timezone,
        aiAuthority: operation.authority,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))
      .returning();
    result.push(await audit(tx, userId, mutationId, "profile", userId, before, after));
  } else {
    const [change] = await tx
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.id, operation.changeId), eq(changeLog.userId, userId)));
    if (
      !change ||
      !["life_record", "task", "schedule_block", "observation"].includes(change.entityType)
    )
      throw new Error("This change cannot be undone here");
    const [latest] = await tx
      .select()
      .from(changeLog)
      .where(
        and(
          eq(changeLog.userId, userId),
          eq(changeLog.entityId, change.entityId),
          eq(changeLog.entityType, change.entityType),
        ),
      )
      .orderBy(desc(changeLog.sequence))
      .limit(1);
    if (latest.id !== change.id || latest.origin === "undo")
      throw new Error("A later change exists. Undo the latest change or edit the record directly.");
    const snapshot = change.before as Record<string, unknown> | null;
    const timestamp = (value: unknown) => (typeof value === "string" ? new Date(value) : null);
    if (change.entityType === "life_record") {
      const [before] = await tx
        .select()
        .from(lifeRecords)
        .where(and(eq(lifeRecords.id, change.entityId), eq(lifeRecords.userId, userId)))
        .for("update");
      if (!before) throw new Error("Record unavailable");
      const data = LifeRecord.parse(snapshot?.data ?? before.data);
      if (snapshot && !snapshot.archivedAt) await assertLinks(tx, userId, data);
      const [after] = await tx
        .update(lifeRecords)
        .set({
          data,
          archivedAt: snapshot ? timestamp(snapshot.archivedAt) : new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(lifeRecords.id, before.id), eq(lifeRecords.userId, userId)))
        .returning();
      result.push(
        await audit(tx, userId, mutationId, "life_record", before.id, before, after, "undo"),
      );
    } else if (change.entityType === "observation") {
      const [before] = await tx
        .select()
        .from(observations)
        .where(and(eq(observations.id, change.entityId), eq(observations.userId, userId)))
        .for("update");
      if (!before) throw new Error("Observation unavailable");
      const saved = snapshot as typeof before | null;
      const [after] = await tx
        .update(observations)
        .set(
          saved
            ? {
                category: saved.category,
                valueText: saved.valueText,
                valueNum: saved.valueNum,
                occurredOn: saved.occurredOn,
                quote: saved.quote,
                source: saved.source,
                sensitivity: saved.sensitivity,
                deletedAt: timestamp(saved.deletedAt),
              }
            : { deletedAt: new Date() },
        )
        .where(and(eq(observations.id, before.id), eq(observations.userId, userId)))
        .returning();
      result.push(
        await audit(tx, userId, mutationId, "observation", before.id, before, after, "undo"),
      );
    } else if (change.entityType === "task") {
      const [before] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, change.entityId), eq(tasks.userId, userId)))
        .for("update");
      if (!before) throw new Error("Task unavailable");
      const saved = snapshot as typeof before | null;
      if (saved) await assertTaskProject(tx, userId, saved.details?.projectId);
      const [after] = await tx
        .update(tasks)
        .set(
          saved
            ? {
                title: saved.title,
                kind: saved.kind,
                dueOn: saved.dueOn,
                priority: saved.priority,
                status: saved.status,
                notes: saved.notes,
                details: saved.details ?? before.details,
                deletedAt: timestamp(saved.deletedAt),
                updatedAt: new Date(),
              }
            : { deletedAt: new Date(), updatedAt: new Date() },
        )
        .where(and(eq(tasks.id, before.id), eq(tasks.userId, userId)))
        .returning();
      result.push(await audit(tx, userId, mutationId, "task", before.id, before, after, "undo"));
    } else {
      const [before] = await tx
        .select()
        .from(scheduleBlocks)
        .where(and(eq(scheduleBlocks.id, change.entityId), eq(scheduleBlocks.userId, userId)))
        .for("update");
      if (!before) throw new Error("Block unavailable");
      const saved = snapshot as typeof before | null;
      const [after] = await tx
        .update(scheduleBlocks)
        .set(
          saved
            ? {
                title: saved.title,
                kind: saved.kind,
                startsAt: timestamp(saved.startsAt)!,
                endsAt: timestamp(saved.endsAt)!,
                fixed: saved.fixed,
                seriesId: saved.seriesId,
                deletedAt: timestamp(saved.deletedAt),
                updatedAt: new Date(),
              }
            : { deletedAt: new Date(), updatedAt: new Date() },
        )
        .where(and(eq(scheduleBlocks.id, before.id), eq(scheduleBlocks.userId, userId)))
        .returning();
      result.push(
        await audit(tx, userId, mutationId, "schedule_block", before.id, before, after, "undo"),
      );
    }
  }
  return result;
}

export async function importRecords(
  tx: DbTransaction,
  userId: string,
  backup: UserBackup,
  timezone: string,
  mutationId: string,
) {
  const result: Awaited<ReturnType<typeof applyWorkspace>> = [];
  const mapping = new Map<string, string>();
  const records = [...backup.records].sort(
    (a, b) => Number(recordLinks(a.data).length > 0) - Number(recordLinks(b.data).length > 0),
  );
  if (new Set(records.map((r) => r.id)).size !== records.length)
    throw new Error("Backup contains duplicate record IDs");
  for (const original of records) {
    const data = structuredClone(original.data);
    const remap = (id: string) => {
      const target = mapping.get(id);
      if (!target) throw new Error("Backup is missing a linked parent record; import it together");
      return target;
    };
    if (data.type === "habit_log") data.habitId = remap(data.habitId);
    if (data.type === "routine_run") data.routineId = remap(data.routineId);
    if (data.type === "workout" && data.planId) data.planId = remap(data.planId);
    if (data.type === "meal_template")
      data.foods = data.foods.map((f) => ({ ...f, foodId: remap(f.foodId) }));
    // Review citations are remapped after tasks/observations; source IDs stay in the backup.
    if (data.type === "review") data.citedIds = [];
    const saved = await applyWorkspace(
      tx,
      userId,
      { op: "record.save", record: data },
      timezone,
      mutationId,
    );
    mapping.set(original.id, saved[0].entityId);
    result.push(...saved);
  }
  for (const original of backup.tasks) {
    const details = original.details
      ? {
          ...original.details,
          projectId: original.details.projectId
            ? (mapping.get(original.details.projectId) ?? null)
            : null,
        }
      : undefined;
    const [row] = await tx
      .insert(tasks)
      .values({
        userId,
        title: original.title,
        kind: original.kind,
        dueOn: original.dueOn,
        priority: original.priority,
        status: original.status,
        notes: original.notes,
        ...(details ? { details } : {}),
        deletedAt: original.deletedAt ? new Date() : null,
        origin: "manual",
      })
      .returning();
    mapping.set(original.id, row.id);
    result.push(await audit(tx, userId, mutationId, "task", row.id, null, row));
  }
  for (const original of backup.blocks) {
    const startsAt = new Date(original.startsAt);
    const endsAt = new Date(original.endsAt);
    if (endsAt <= startsAt) throw new Error("Backup contains a block with invalid times");
    const [row] = await tx
      .insert(scheduleBlocks)
      .values({
        userId,
        title: original.title,
        kind: original.kind,
        startsAt,
        endsAt,
        fixed: original.fixed,
        deletedAt: original.deletedAt ? new Date() : null,
        origin: "manual",
      })
      .returning();
    result.push(await audit(tx, userId, mutationId, "schedule_block", row.id, null, row));
    if (original.id) mapping.set(original.id, row.id);
  }
  for (const original of backup.observations) {
    const [row] = await tx
      .insert(observations)
      .values({
        userId,
        category: original.category,
        valueText: original.valueText,
        valueNum: original.valueNum ?? null,
        occurredOn: original.occurredOn,
        source: "manual_entry",
        quote: original.valueText,
        sensitivity: original.category === "note" ? "normal" : "health",
        origin: "manual",
        deletedAt: original.deletedAt ? new Date() : null,
      })
      .returning();
    if (original.id) mapping.set(original.id, row.id);
    result.push(await audit(tx, userId, mutationId, "observation", row.id, null, row));
  }
  for (const original of records.filter((r) => r.data.type === "review")) {
    const id = mapping.get(original.id)!;
    const record = original.data;
    if (record.type !== "review") continue;
    const [before] = await tx
      .select()
      .from(lifeRecords)
      .where(and(eq(lifeRecords.id, id), eq(lifeRecords.userId, userId)));
    const [after] = await tx
      .update(lifeRecords)
      .set({
        data: {
          ...record,
          citedIds: record.citedIds
            .map((id) => mapping.get(id))
            .filter((id): id is string => Boolean(id)),
        },
      })
      .where(and(eq(lifeRecords.id, id), eq(lifeRecords.userId, userId)))
      .returning();
    if (record.citedIds.length)
      result.push(await audit(tx, userId, mutationId, "life_record", id, before, after));
  }
  for (const original of records.filter((r) => r.archivedAt))
    result.push(
      ...(await applyWorkspace(
        tx,
        userId,
        { op: "record.archive", id: mapping.get(original.id)!, archive: true },
        timezone,
        mutationId,
      )),
    );
  return result;
}
