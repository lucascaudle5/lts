import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { IsoDate, Warning } from "@/contracts/common";
import type { ProposalDraft } from "@/contracts/proposals";
import { checkDraftSafety, matchesRiskLanguage } from "@/domain/safety";
import { getDb, type Db } from "@/server/db/client";
import { harnessRuns, proposalItems } from "@/server/db/schema";
import { getCapture } from "@/server/repositories/captures";

import { assessProposalDraft } from "@/server/compiler/assessment";
import { parseCapture } from "@/server/parser/parseCapture";

const PARSER_VERSION = "parser@1";

export interface InterpretCaptureResult {
  items: number;
  droppedCount: number;
  safetyStop: boolean;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Runs the deterministic parser and persists only capture/proposal/trace bookkeeping. */
export async function interpretCapture(
  userId: string,
  captureId: string,
  db: Db = getDb(),
): Promise<InterpretCaptureResult> {
  const capture = await getCapture(userId, captureId, db);
  if (!capture) throw new Error("Capture not found");
  if (capture.safetyStop || matchesRiskLanguage(capture.text)) {
    return { items: 0, droppedCount: 0, safetyStop: true };
  }

  const drafts = parseCapture(capture.text, capture.referenceDate as IsoDate);

  let droppedCount = 0;
  const accepted: Array<{
    id: string;
    draft: ProposalDraft;
    status: "ready" | "needs_input";
    missingSlots: Awaited<ReturnType<typeof assessProposalDraft>>["missingSlots"];
    warnings: Warning[];
  }> = [];

  for (const draft of drafts) {
    if (checkDraftSafety(draft, capture.text).length > 0) {
      droppedCount += 1;
      continue;
    }
    const assessment = await assessProposalDraft(
      userId,
      draft,
      capture.referenceDate as IsoDate,
      capture.timezone,
      db,
    );
    accepted.push({
      id: randomUUID(),
      draft,
      status: assessment.status,
      missingSlots: assessment.missingSlots,
      warnings: assessment.warnings,
    });
  }

  const runId = randomUUID();
  const outputHash = digest(JSON.stringify(accepted.map(({ draft }) => draft)));
  await db.transaction(async (tx) => {
    await tx.insert(harnessRuns).values({
      id: runId,
      userId,
      captureId,
      provider: "parser",
      model: null,
      promptVersion: PARSER_VERSION,
      promptSha256: digest(PARSER_VERSION),
      outputSha256: outputHash,
      status: "succeeded",
      validationErrorCodes: droppedCount > 0 ? ["invalid_drafts_dropped"] : [],
      proposalItemIds: accepted.map((item) => item.id),
      toolCalls: [],
    });

    if (accepted.length > 0) {
      await tx.insert(proposalItems).values(
        accepted.map(({ id, draft, status, missingSlots, warnings }) => ({
          id,
          userId,
          captureId,
          harnessRunId: runId,
          kind: draft.kind,
          payload: draft.payload,
          originalPayload: draft.payload,
          status,
          missingSlots,
          warnings,
          source: "parser" as const,
          confidence: draft.confidence,
          quote: draft.quote,
        })),
      );
    }
  });

  return { items: accepted.length, droppedCount, safetyStop: false };
}
