import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/server/db/client";
import { changeLog, captures, profiles, proposalItems, tasks } from "@/server/db/schema";
import { createTestDatabase, type TestDatabase } from "@/server/db/test-database";
import { createCapture } from "@/server/captures";
import { interpretCapture } from "@/server/compiler/interpretCapture";
import { approveItems } from "@/server/approval/approveItems";
import { rejectItems } from "@/server/approval/rejectItems";
import { getCapture } from "@/server/repositories/captures";
import { listProposalItemsForCapture } from "@/server/repositories/proposals";
import { runMutations } from "./runMutations";

const A = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "bbbbbbbb-0000-4000-8000-00000000000b";
const TZ = "America/Chicago";
const NOW = new Date("2026-10-07T15:30:00Z");

let testDb: TestDatabase;
let db: Db;

async function createCaptureAndProposal(
  owner: string,
  options: { status?: "ready" | "needs_input"; missingTitle?: boolean } = {},
) {
  const capture = await createCapture(owner, "need groceries", TZ, NOW, db);
  const id = randomUUID();
  const payload = options.missingTitle
    ? { taskKind: "errand" }
    : { title: "Groceries", taskKind: "errand" };
  await db.insert(proposalItems).values({
    id,
    userId: owner,
    captureId: capture.captureId,
    kind: "task.create",
    payload,
    originalPayload: payload,
    status: options.status ?? "ready",
    missingSlots: options.missingTitle ? [{ path: "title", reason: "What's the task?" }] : [],
    warnings: [],
    source: "parser",
    confidence: "high",
    quote: "need groceries",
  });
  return { captureId: capture.captureId, itemId: id };
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
});

beforeEach(async () => {
  await db.delete(profiles).where(eq(profiles.userId, A));
  await db.delete(profiles).where(eq(profiles.userId, B));
  await db.insert(profiles).values([
    { userId: A, timezone: TZ },
    { userId: B, timezone: TZ },
  ]);
});

afterAll(async () => {
  await testDb?.drop();
});

describe("M3 capture and approval loop", () => {
  it("interpretCapture persists proposals but no domain rows", async () => {
    const created = await createCapture(A, "dentist friday 3-4pm, need groceries", TZ, NOW, db);
    const result = await interpretCapture(A, created.captureId, db);
    const [captureRow] = await db
      .select({ id: captures.id })
      .from(captures)
      .where(eq(captures.id, created.captureId));
    const proposalRows = await db
      .select()
      .from(proposalItems)
      .where(eq(proposalItems.captureId, created.captureId));
    const domainTasks = await db.select().from(tasks).where(eq(tasks.userId, A));

    expect(captureRow.id).toBe(created.captureId);
    expect(result).toMatchObject({ items: 2, safetyStop: false });
    expect(proposalRows).toHaveLength(2);
    expect(domainTasks).toEqual([]);
  });

  it("keeps capture and proposal reads scoped to their owner", async () => {
    const ownedByA = await createCapture(A, "need groceries", TZ, NOW, db);
    const interpreted = await interpretCapture(A, ownedByA.captureId, db);
    expect(interpreted.items).toBe(1);
    expect(await getCapture(B, ownedByA.captureId, db)).toBeNull();
    await expect(listProposalItemsForCapture(B, ownedByA.captureId, db)).resolves.toEqual([]);
  });

  it("blocks missing slots and cross-user approvals", async () => {
    const needsInput = await createCaptureAndProposal(A, {
      status: "needs_input",
      missingTitle: true,
    });
    await expect(approveItems(A, [needsInput.itemId], db)).rejects.toThrow("ready proposals");

    const ownedByA = await createCaptureAndProposal(A);
    await expect(approveItems(B, [ownedByA.itemId], db)).rejects.toThrow("unavailable");
    await expect(db.select().from(tasks).where(eq(tasks.userId, A))).resolves.toEqual([]);
  });

  it("writes the approved task and audit row together through runMutations", async () => {
    const { itemId } = await createCaptureAndProposal(A);
    const result = await approveItems(A, [itemId], db);
    const [task] = await db.select().from(tasks).where(eq(tasks.userId, A));
    const [log] = await db.select().from(changeLog).where(eq(changeLog.proposalItemId, itemId));
    const [item] = await db.select().from(proposalItems).where(eq(proposalItems.id, itemId));

    expect(result.applied).toHaveLength(1);
    expect(task).toMatchObject({
      title: "Groceries",
      kind: "errand",
      origin: "proposal",
      originItemId: itemId,
    });
    expect(log).toMatchObject({
      mutationId: result.mutationId,
      entityType: "task",
      entityId: task.id,
      action: "create",
      before: null,
      actor: "user",
      origin: "proposal",
      proposalItemId: itemId,
    });
    expect(log.after).toMatchObject({ title: "Groceries", originItemId: itemId });
    expect(item.status).toBe("applied");
  });

  it("rolls back every row if a later audit write fails", async () => {
    const first = await createCaptureAndProposal(A);
    const second = await createCaptureAndProposal(A);
    await db.execute(
      sql.raw(`create function fail_selected_change_log() returns trigger language plpgsql as $$
      begin
        if new.proposal_item_id = '${second.itemId}'::uuid then
          raise exception 'injected audit failure';
        end if;
        return new;
      end;
      $$;`),
    );
    await db.execute(
      sql.raw(
        "create trigger fail_selected_change_log before insert on change_log for each row execute function fail_selected_change_log();",
      ),
    );

    await expect(
      runMutations(A, { origin: "proposal", itemIds: [first.itemId, second.itemId] }, db),
    ).rejects.toThrow("injected audit failure");
    await db.execute(sql.raw("drop trigger fail_selected_change_log on change_log;"));
    await db.execute(sql.raw("drop function fail_selected_change_log();"));
    await expect(db.select().from(tasks).where(eq(tasks.userId, A))).resolves.toEqual([]);
    await expect(db.select().from(changeLog).where(eq(changeLog.userId, A))).resolves.toEqual([]);
    const items = await db.select().from(proposalItems).where(eq(proposalItems.userId, A));
    expect(items.every((item) => item.status === "ready")).toBe(true);
  });

  it("rejects items without creating domain rows", async () => {
    const { itemId } = await createCaptureAndProposal(A);
    await expect(rejectItems(A, [itemId], db)).resolves.toEqual([itemId]);
    await expect(db.select().from(tasks).where(eq(tasks.userId, A))).resolves.toEqual([]);
    const [item] = await db.select().from(proposalItems).where(eq(proposalItems.id, itemId));
    expect(item.status).toBe("rejected");
  });

  it("routes direct manual creates through the same audit transaction", async () => {
    const result = await runMutations(
      A,
      {
        origin: "manual",
        timezone: TZ,
        commands: [
          {
            command: {
              kind: "task.create",
              payload: { title: "Laundry", taskKind: "chore" },
            },
          },
        ],
      },
      db,
    );
    const [task] = await db.select().from(tasks).where(eq(tasks.userId, A));
    const [log] = await db.select().from(changeLog).where(eq(changeLog.userId, A));
    expect(task).toMatchObject({ title: "Laundry", origin: "manual", originItemId: null });
    expect(log).toMatchObject({
      mutationId: result.mutationId,
      entityType: "task",
      action: "create",
      actor: "user",
      origin: "manual",
      proposalItemId: null,
    });
  });
});
