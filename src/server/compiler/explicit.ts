import "server-only";

import { TaskCreate } from "@/contracts/commands";
import type { ProposalDraft } from "@/contracts/proposals";
import { findDateExpressions } from "@/domain/dates";
import { matchesRiskLanguage } from "@/domain/safety";
import { getDb, type Db } from "@/server/db/client";
import { getCapture } from "@/server/repositories/captures";
import { getPreferences } from "@/server/repositories/profiles";
import { listProposalItemsForCapture } from "@/server/repositories/proposals";
import { approveItems } from "@/server/approval/approveItems";

export function explicitTaskDraft(text: string, referenceDate: string): ProposalDraft | null {
  const match = text.match(/^\s*(?:add|create)\s+(?:a\s+)?task\s*:\s*([\s\S]+)$/i);
  if (!match || matchesRiskLanguage(text)) return null;
  const body = match[1].trim();
  const dates = findDateExpressions(body, referenceDate);
  let title = body;
  for (const date of dates) title = title.replace(date.match, "").trim();
  const payload = TaskCreate.safeParse({
    title,
    taskKind: "other",
    ...(dates[0] ? { dueOn: dates[0].date } : {}),
  });
  return payload.success
    ? { kind: "task.create", payload: payload.data, quote: text, confidence: "high" }
    : null;
}

export async function applyAllowedExplicitTask(
  userId: string,
  captureId: string,
  db: Db = getDb(),
): Promise<boolean> {
  const profile = await getPreferences(userId, db);
  if (profile?.authority !== "allow_explicit") return false;
  const capture = await getCapture(userId, captureId, db);
  if (!capture || capture.safetyStop) return false;
  const expected = explicitTaskDraft(capture.text, capture.referenceDate);
  if (!expected) return false;
  const items = await listProposalItemsForCapture(userId, captureId, db);
  if (
    items.length !== 1 ||
    items[0].kind !== "task.create" ||
    items[0].status !== "ready" ||
    items[0].provenance.source !== "parser" ||
    JSON.stringify(items[0].payload) !== JSON.stringify(expected.payload)
  )
    return false;
  await approveItems(userId, [items[0].id], db);
  return true;
}
