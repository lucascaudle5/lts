import "server-only";

import { GetScheduleInput, GetScheduleOutput } from "@/contracts/tools";
import { addDaysIso, instantToLocal, localDateTimeToInstant } from "@/domain/dates";
import type { Db } from "@/server/db/client";
import { listBlocksStartingBetween } from "@/server/repositories/blocks";

export async function getScheduleTool(userId: string, input: unknown, timezone: string, db?: Db) {
  const { from, to } = GetScheduleInput.parse(input);
  const blocks = await listBlocksStartingBetween(
    userId,
    {
      from: localDateTimeToInstant(from, "00:00", timezone),
      to: localDateTimeToInstant(addDaysIso(to, 1), "00:00", timezone),
    },
    db,
  );
  return GetScheduleOutput.parse({
    blocks: blocks.map((block) => {
      const start = instantToLocal(block.startsAt, timezone);
      const end = instantToLocal(block.endsAt, timezone);
      return {
        id: block.id,
        title: block.title,
        blockKind: block.kind,
        date: start.date,
        start: start.time,
        end: end.time,
        fixed: block.fixed,
      };
    }),
  });
}
