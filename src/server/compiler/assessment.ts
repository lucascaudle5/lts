import "server-only";

import type { IsoDate, Warning } from "@/contracts/common";
import type { ProposalDraft } from "@/contracts/proposals";
import { addDaysIso, instantToLocal, localDateTimeToInstant } from "@/domain/dates";
import { assessDraft } from "@/domain/validate";
import { getDb, type Db } from "@/server/db/client";
import { listBlocksStartingBetween } from "@/server/repositories/blocks";
import { listOpenTasks } from "@/server/repositories/tasks";

import { parserWarnings } from "@/server/parser/parseCapture";

export function mergeWarnings(...groups: Warning[][]): Warning[] {
  const unique = new Map<Warning["code"], Warning>();
  for (const warning of groups.flat()) unique.set(warning.code, warning);
  return [...unique.values()];
}

export async function assessProposalDraft(
  userId: string,
  draft: ProposalDraft,
  referenceDate: IsoDate,
  timezone: string,
  db: Db = getDb(),
) {
  const [openTasks, blocks] = await Promise.all([
    listOpenTasks(userId, {}, db),
    draft.kind === "schedule_block.create" && draft.payload.date
      ? listBlocksStartingBetween(
          userId,
          {
            from: localDateTimeToInstant(draft.payload.date, "00:00", timezone),
            to: localDateTimeToInstant(addDaysIso(draft.payload.date, 1), "00:00", timezone),
          },
          db,
        )
      : Promise.resolve([]),
  ]);
  const existingBlocks = blocks.map((block) => {
    const start = instantToLocal(block.startsAt, timezone);
    const end = instantToLocal(block.endsAt, timezone);
    return {
      id: block.id,
      title: block.title,
      fixed: block.fixed,
      date: start.date,
      start: start.time,
      end: end.time,
    };
  });
  const assessment = assessDraft(draft, { referenceDate, existingBlocks, openTasks });
  return {
    ...assessment,
    warnings: mergeWarnings(assessment.warnings, parserWarnings(draft, referenceDate)),
  };
}
