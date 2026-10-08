import "server-only";

import { ListOpenTasksInput, ListOpenTasksOutput } from "@/contracts/tools";
import type { Db } from "@/server/db/client";
import { listOpenTasks } from "@/server/repositories/tasks";

export async function listOpenTasksTool(userId: string, input: unknown, db?: Db) {
  const { limit } = ListOpenTasksInput.parse(input);
  const tasks = await listOpenTasks(userId, { limit }, db);
  return ListOpenTasksOutput.parse({
    tasks: tasks.map(({ id, title, dueOn }) => ({ id, title, dueOn })),
  });
}
