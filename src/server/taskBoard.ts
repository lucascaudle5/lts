import "server-only";

import { todayInTimezone } from "@/domain/dates";
import { listTasks } from "@/server/repositories/tasks";

export async function getTaskBoard(userId: string, timezone: string, now: Date) {
  const [tasks] = await Promise.all([listTasks(userId)]);
  return { tasks, today: todayInTimezone(now, timezone) };
}
