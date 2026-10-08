import "server-only";

import { addDaysIso, instantToLocal, localDateTimeToInstant } from "@/domain/dates";
import { GetTodayInput, GetTodayOutput } from "@/contracts/tools";
import type { Db } from "@/server/db/client";
import { listBlocksStartingBetween } from "@/server/repositories/blocks";
import { countOpenTasks } from "@/server/repositories/tasks";

export async function getTodayTool(userId: string, input: unknown, timezone: string, db?: Db) {
  const { date } = GetTodayInput.parse(input);
  const from = localDateTimeToInstant(date, "00:00", timezone);
  const to = localDateTimeToInstant(addDaysIso(date, 1), "00:00", timezone);
  const [blocks, openTaskCount] = await Promise.all([
    listBlocksStartingBetween(userId, { from, to }, db),
    countOpenTasks(userId, db),
  ]);
  const output = {
    date,
    blocks: blocks.map((block) => ({
      id: block.id,
      title: block.title,
      blockKind: block.kind,
      date: instantToLocal(block.startsAt, timezone).date,
      start: new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(block.startsAt),
      end: new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(block.endsAt),
      fixed: block.fixed,
    })),
    openTaskCount,
  };
  return GetTodayOutput.parse(output);
}
