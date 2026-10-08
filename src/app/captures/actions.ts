"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { BlockKind, ObservationCategory, TaskKind, Uuid } from "@/contracts/common";
import { CreateCaptureInput } from "@/contracts/captures";
import {
  ObservationRecordDraft,
  ScheduleBlockCreateDraft,
  TaskCreateDraft,
} from "@/contracts/proposals";
import { approveItems } from "@/server/approval/approveItems";
import { rejectItems } from "@/server/approval/rejectItems";
import { updateProposalItem } from "@/server/approval/updateItem";
import { interpretCapture } from "@/server/compiler/interpretCapture";
import { createCapture } from "@/server/captures";
import { requireUser } from "@/server/auth";
import { applyAllowedExplicitTask } from "@/server/compiler/explicit";

function optionalText(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requiredId(formData: FormData, name: string): string {
  return Uuid.parse(formData.get(name)).toString();
}

export async function createCaptureAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const input = CreateCaptureInput.safeParse({ text: formData.get("text") });
  if (!input.success) redirect("/today?capture=invalid");

  const created = await createCapture(user.userId, input.data.text, user.timezone);
  if (!created.safetyStop) {
    await interpretCapture(user.userId, created.captureId);
    if (await applyAllowedExplicitTask(user.userId, created.captureId)) {
      revalidatePath("/today");
      revalidatePath("/tasks");
      redirect("/today?added=1");
    }
  }
  redirect(`/captures/${created.captureId}`);
}

export async function updateProposalItemAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const itemId = requiredId(formData, "itemId");
  const captureId = requiredId(formData, "captureId");
  const kind = formData.get("kind");

  let payload: unknown;
  if (kind === "schedule_block.create") {
    payload = ScheduleBlockCreateDraft.parse({
      ...(optionalText(formData, "title") ? { title: optionalText(formData, "title") } : {}),
      ...(BlockKind.safeParse(formData.get("blockKind")).success
        ? { blockKind: BlockKind.parse(formData.get("blockKind")) }
        : {}),
      ...(optionalText(formData, "date") ? { date: optionalText(formData, "date") } : {}),
      ...(optionalText(formData, "start") ? { start: optionalText(formData, "start") } : {}),
      ...(optionalText(formData, "end") ? { end: optionalText(formData, "end") } : {}),
      fixed: formData.get("fixed") === "true",
    });
  } else if (kind === "task.create") {
    payload = TaskCreateDraft.parse({
      ...(optionalText(formData, "title") ? { title: optionalText(formData, "title") } : {}),
      ...(TaskKind.safeParse(formData.get("taskKind")).success
        ? { taskKind: TaskKind.parse(formData.get("taskKind")) }
        : {}),
      ...(optionalText(formData, "dueOn") ? { dueOn: optionalText(formData, "dueOn") } : {}),
      ...(optionalText(formData, "notes") ? { notes: optionalText(formData, "notes") } : {}),
    });
  } else if (kind === "observation.record") {
    payload = ObservationRecordDraft.parse({
      ...(ObservationCategory.safeParse(formData.get("category")).success
        ? { category: ObservationCategory.parse(formData.get("category")) }
        : {}),
      ...(optionalText(formData, "valueText")
        ? { valueText: optionalText(formData, "valueText") }
        : {}),
      ...(optionalText(formData, "occurredOn")
        ? { occurredOn: optionalText(formData, "occurredOn") }
        : {}),
    });
  } else {
    throw new Error("Unknown proposal kind");
  }

  await updateProposalItem(user.userId, itemId, payload);
  revalidatePath(`/captures/${captureId}`);
}

export async function approveItemsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const itemIds = formData.getAll("itemId").map((id) => Uuid.parse(id).toString());
  const result = await approveItems(user.userId, itemIds);
  revalidatePath("/today");
  redirect(`/today?added=${result.applied.length}`);
}

export async function rejectItemsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const itemIds = formData.getAll("itemId").map((id) => Uuid.parse(id).toString());
  const captureId = requiredId(formData, "captureId");
  await rejectItems(user.userId, itemIds);
  revalidatePath(`/captures/${captureId}`);
}
