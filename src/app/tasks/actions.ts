"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { TaskCreate, TaskUpdate } from "@/contracts/commands";
import { TaskKind, TaskPriority, TaskStatus, Uuid } from "@/contracts/common";
import { requireUser } from "@/server/auth";
import { runMutations } from "@/server/mutations/runMutations";

function optionalText(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function refreshTasks(): void {
  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const input = TaskCreate.safeParse({
    title: formData.get("title"),
    taskKind: TaskKind.safeParse(formData.get("taskKind")).success
      ? formData.get("taskKind")
      : undefined,
    ...(optionalText(formData, "dueOn") ? { dueOn: optionalText(formData, "dueOn") } : {}),
    priority: TaskPriority.safeParse(formData.get("priority")).success
      ? formData.get("priority")
      : undefined,
    ...(optionalText(formData, "notes") ? { notes: optionalText(formData, "notes") } : {}),
  });
  if (!input.success) redirect("/tasks?task=invalid");

  await runMutations(user.userId, {
    origin: "manual",
    timezone: user.timezone,
    commands: [{ command: { kind: "task.create", payload: input.data } }],
  });
  refreshTasks();
}

export async function updateTaskAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = Uuid.safeParse(formData.get("taskId"));
  const status = TaskStatus.safeParse(formData.get("status"));
  const priority = TaskPriority.safeParse(formData.get("priority"));
  const taskKind = TaskKind.safeParse(formData.get("taskKind"));
  if (!taskId.success || !status.success || !priority.success || !taskKind.success) {
    redirect("/tasks?task=invalid");
  }

  const input = TaskUpdate.safeParse({
    taskId: taskId.data,
    title: formData.get("title"),
    taskKind: taskKind.data,
    status: status.data,
    priority: priority.data,
    dueOn: optionalText(formData, "dueOn") ?? null,
    notes: optionalText(formData, "notes") ?? null,
  });
  if (!input.success) redirect("/tasks?task=invalid");

  await runMutations(user.userId, {
    origin: "manual",
    timezone: user.timezone,
    commands: [{ command: { kind: "task.update", payload: input.data } }],
  });
  refreshTasks();
}
