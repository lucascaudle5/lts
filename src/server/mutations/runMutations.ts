import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  WorkspaceOperation,
  UserBackup,
  type WorkspaceOperation as WorkspaceOperationType,
  type UserBackup as UserBackupType,
} from "@/contracts/life";

import { DomainCommand, type DomainCommand as DomainCommandType } from "@/contracts/commands";
import {
  Actor,
  TaskStatus,
  type IsoDate,
  Uuid,
  Timezone,
  SensitiveCategory,
} from "@/contracts/common";
import type { ChangeOrigin, SensitiveCategory as SensitiveCategoryType } from "@/contracts/common";
import type { TaskStatus as TaskStatusType } from "@/contracts/common";
import { ProposalDraft } from "@/contracts/proposals";
import { localDateTimeToInstant } from "@/domain/dates";
import { checkDraftSafety } from "@/domain/safety";
import { getDb, type Db, type DbTransaction } from "@/server/db/client";
import {
  captures,
  changeLog,
  observations,
  proposalItems,
  profiles,
  scheduleBlocks,
  tasks,
} from "@/server/db/schema";
import { assessProposalDraft } from "@/server/compiler/assessment";
import { applyWorkspace, assertTaskProject, importRecords } from "./workspace";

type EntityType = "schedule_block" | "task" | "observation" | "profile" | "life_record";

export type MutationRequest =
  | { origin: "proposal"; itemIds: readonly string[] }
  | {
      origin: "manual";
      commands: readonly { command: DomainCommandType; taskStatus?: TaskStatusType }[];
      timezone: string;
      actor?: Actor;
    }
  | { origin: "manual"; sensitiveCategories: readonly SensitiveCategoryType[] }
  | { origin: "manual"; workspace: readonly WorkspaceOperationType[]; timezone: string }
  | { origin: "manual"; importBackup: UserBackupType; timezone: string };

export interface MutationResult {
  mutationId: string;
  applied: Array<{
    proposalItemId: string | null;
    entityType: EntityType;
    entityId: string;
  }>;
}

function jsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

async function applyCommand(
  tx: DbTransaction,
  userId: string,
  command: DomainCommandType,
  options: {
    origin: ChangeOrigin;
    actor: Actor;
    timezone: string;
    proposalItemId: string | null;
    mutationId: string;
    taskStatus?: TaskStatusType;
    quote?: string;
  },
): Promise<MutationResult["applied"][number]> {
  let entityType: EntityType;
  let entityId: string;
  let after: unknown;
  let before: unknown = null;
  let action: "create" | "update" = "create";

  if (command.kind === "schedule_block.create") {
    if (command.payload.end <= command.payload.start) {
      throw new Error("The end time has to be after the start time");
    }
    const row = (
      await tx
        .insert(scheduleBlocks)
        .values({
          userId,
          title: command.payload.title,
          kind: command.payload.blockKind,
          startsAt: localDateTimeToInstant(
            command.payload.date,
            command.payload.start,
            options.timezone,
          ),
          endsAt: localDateTimeToInstant(
            command.payload.date,
            command.payload.end,
            options.timezone,
          ),
          fixed: command.payload.fixed,
          origin: options.origin,
          originItemId: options.proposalItemId,
        })
        .returning()
    )[0];
    entityType = "schedule_block";
    entityId = row.id;
    after = row;
  } else if (command.kind === "task.create") {
    await assertTaskProject(tx, userId, command.payload.details?.projectId);
    const row = (
      await tx
        .insert(tasks)
        .values({
          userId,
          title: command.payload.title,
          kind: command.payload.taskKind,
          dueOn: command.payload.dueOn ?? null,
          priority: command.payload.priority ?? "medium",
          status: options.taskStatus ?? "open",
          notes: command.payload.notes ?? null,
          ...(command.payload.details ? { details: command.payload.details } : {}),
          origin: options.origin,
          originItemId: options.proposalItemId,
        })
        .returning()
    )[0];
    entityType = "task";
    entityId = row.id;
    after = row;
  } else if (command.kind === "task.update") {
    await assertTaskProject(tx, userId, command.payload.details?.projectId);
    const [current] = await tx
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.id, command.payload.taskId),
          eq(tasks.userId, userId),
          isNull(tasks.deletedAt),
        ),
      )
      .for("update");
    if (!current) throw new Error("Task not found");
    if (
      command.payload.expectedUpdatedAt &&
      current.updatedAt.toISOString() !== command.payload.expectedUpdatedAt
    )
      throw new Error("This task changed. Refresh before saving again.");
    const [updated] = await tx
      .update(tasks)
      .set({
        ...(command.payload.title !== undefined ? { title: command.payload.title } : {}),
        ...(command.payload.taskKind ? { kind: command.payload.taskKind } : {}),
        ...(command.payload.status ? { status: command.payload.status } : {}),
        ...(command.payload.priority ? { priority: command.payload.priority } : {}),
        ...(command.payload.dueOn !== undefined ? { dueOn: command.payload.dueOn } : {}),
        ...(command.payload.notes !== undefined ? { notes: command.payload.notes } : {}),
        ...(command.payload.details !== undefined ? { details: command.payload.details } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, current.id), eq(tasks.userId, userId)))
      .returning();
    entityType = "task";
    entityId = current.id;
    before = current;
    after = updated;
    action = "update";
  } else {
    const row = (
      await tx
        .insert(observations)
        .values({
          userId,
          category: command.payload.category,
          valueText: command.payload.valueText,
          valueNum: command.payload.valueNum ?? null,
          occurredOn: command.payload.occurredOn,
          source: options.origin === "proposal" ? "user_statement" : "manual_entry",
          quote: options.quote ?? command.payload.valueText,
          sensitivity: command.payload.category === "note" ? "normal" : "health",
          origin: options.origin,
          originItemId: options.proposalItemId,
        })
        .returning()
    )[0];
    entityType = "observation";
    entityId = row.id;
    after = row;
  }

  const mutationId = options.mutationId;
  await tx.insert(changeLog).values({
    userId,
    mutationId,
    entityType,
    entityId,
    action,
    before: jsonValue(before),
    after: jsonValue(after),
    actor: options.actor,
    origin: options.origin,
    proposalItemId: options.proposalItemId,
  });
  return { proposalItemId: options.proposalItemId, entityType, entityId };
}

/** All consequential domain writes use this transaction boundary. */
export async function runMutations(
  userId: string,
  request: MutationRequest,
  db: Db = getDb(),
): Promise<MutationResult> {
  const parsedUserId = Uuid.parse(userId);

  return db.transaction(async (tx) => {
    // Serializes this user's edits, daily upserts, and undo without blocking other accounts.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${parsedUserId}, 0))`);
    const mutationId = randomUUID();
    const applied: MutationResult["applied"] = [];

    if (request.origin === "manual") {
      if ("importBackup" in request) {
        const backup = UserBackup.parse(request.importBackup);
        const timezone = Timezone.parse(request.timezone);
        applied.push(...(await importRecords(tx, parsedUserId, backup, timezone, mutationId)));
        return { mutationId, applied };
      }
      if ("workspace" in request) {
        if (!request.workspace.length || request.workspace.length > 500)
          throw new Error("Choose between 1 and 500 changes");
        const operations = request.workspace.map((operation) =>
          WorkspaceOperation.parse(operation),
        );
        const timezone = Timezone.parse(request.timezone);
        for (const operation of operations)
          applied.push(
            ...(await applyWorkspace(tx, parsedUserId, operation, timezone, mutationId)),
          );
        return { mutationId, applied };
      }
      if ("sensitiveCategories" in request) {
        const categories = [
          ...new Set(request.sensitiveCategories.map((item) => SensitiveCategory.parse(item))),
        ];
        const [before] = await tx
          .select()
          .from(profiles)
          .where(eq(profiles.userId, parsedUserId))
          .for("update");
        if (!before) throw new Error("Profile not found");
        const [after] = await tx
          .update(profiles)
          .set({ aiSensitiveCategories: categories, updatedAt: new Date() })
          .where(eq(profiles.userId, parsedUserId))
          .returning();
        await tx.insert(changeLog).values({
          userId: parsedUserId,
          mutationId,
          entityType: "profile",
          entityId: parsedUserId,
          action: "update",
          before: jsonValue({ aiSensitiveCategories: before.aiSensitiveCategories }),
          after: jsonValue({ aiSensitiveCategories: after.aiSensitiveCategories }),
          actor: "user",
          origin: "manual",
          proposalItemId: null,
        });
        return {
          mutationId,
          applied: [{ proposalItemId: null, entityType: "profile", entityId: parsedUserId }],
        };
      }
      if (!("commands" in request)) throw new Error("A manual mutation request is required");
      if (request.commands.length === 0) throw new Error("Add at least one change");
      const timezone = Timezone.parse(request.timezone);
      const actor = Actor.parse(request.actor ?? "user");
      const commands = request.commands.map(({ command, taskStatus }) => ({
        command: DomainCommand.parse(command),
        ...(taskStatus ? { taskStatus: TaskStatus.parse(taskStatus) } : {}),
      }));
      for (const { command, taskStatus } of commands) {
        if (taskStatus && command.kind !== "task.create") {
          throw new Error("Task status only applies when creating a task");
        }
        applied.push(
          await applyCommand(tx, parsedUserId, command, {
            origin: "manual",
            actor,
            timezone,
            proposalItemId: null,
            mutationId,
            ...(taskStatus ? { taskStatus } : {}),
          }),
        );
      }
      return { mutationId, applied };
    }

    const ids = [...new Set(request.itemIds.map((id) => Uuid.parse(id)))];
    if (ids.length === 0) throw new Error("Choose at least one proposal to approve");
    const rows = await tx
      .select({ item: proposalItems, capture: captures })
      .from(proposalItems)
      .innerJoin(captures, eq(proposalItems.captureId, captures.id))
      .where(
        and(
          eq(proposalItems.userId, parsedUserId),
          eq(captures.userId, parsedUserId),
          inArray(proposalItems.id, ids),
        ),
      )
      .for("update", { of: proposalItems });

    if (rows.length !== ids.length) throw new Error("One or more proposals are unavailable");
    if (rows.some(({ item, capture }) => item.status !== "ready" || capture.safetyStop)) {
      throw new Error("Only ready proposals can be approved");
    }

    for (const { item, capture } of rows) {
      const draft = ProposalDraft.parse({
        kind: item.kind,
        payload: item.payload,
        quote: item.quote,
        confidence: item.confidence,
      });
      if (checkDraftSafety(draft, capture.text).length > 0) {
        throw new Error("This proposal no longer passes safety checks");
      }
      const assessment = await assessProposalDraft(
        parsedUserId,
        draft,
        capture.referenceDate as IsoDate,
        capture.timezone,
        tx as unknown as Db,
      );
      if (assessment.status !== "ready") {
        throw new Error("Fill the required slots before approving");
      }
      const command = DomainCommand.parse({ kind: item.kind, payload: item.payload });
      const result = await applyCommand(tx, parsedUserId, command, {
        origin: "proposal",
        actor: "user",
        timezone: capture.timezone,
        proposalItemId: item.id,
        quote: draft.quote,
        mutationId,
      });
      await tx
        .update(proposalItems)
        .set({
          status: "applied",
          decidedAt: new Date(),
          appliedEntityId: result.entityId,
          updatedAt: new Date(),
        })
        .where(and(eq(proposalItems.id, item.id), eq(proposalItems.userId, parsedUserId)));
      applied.push(result);
    }

    return { mutationId, applied };
  });
}
