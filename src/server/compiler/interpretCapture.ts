import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { lt } from "drizzle-orm";

import type { IsoDate, Warning } from "@/contracts/common";
import type { ProposalDraft } from "@/contracts/proposals";
import { checkDraftSafety, matchesRiskLanguage } from "@/domain/safety";
import { getDb, type Db } from "@/server/db/client";
import { harnessRunPayloads, harnessRuns, proposalItems } from "@/server/db/schema";
import { getCapture } from "@/server/repositories/captures";

import { assessProposalDraft } from "@/server/compiler/assessment";
import { parseCapture } from "@/server/parser/parseCapture";
import { runHarness } from "@/ai/harness";
import type { AiProvider } from "@/ai/provider";
import { MockProvider } from "@/ai/providers/mock";
import { GatewayProvider } from "@/ai/providers/gateway";
import { INTERPRET_SYSTEM_PROMPT } from "@/ai/prompts/interpret";
import { explicitTaskDraft } from "./explicit";

export interface InterpretCaptureResult {
  items: number;
  droppedCount: number;
  safetyStop: boolean;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function traceSettings() {
  const mode = process.env.LTS_AI_TRACE_MODE === "full" ? "full" : "metadata";
  const parsedRetention = Number.parseInt(process.env.LTS_AI_TRACE_RETENTION_DAYS ?? "7", 10);
  const retentionDays = Number.isFinite(parsedRetention)
    ? Math.min(Math.max(parsedRetention, 1), 30)
    : 7;
  return { mode, retentionDays };
}

/** Interprets via the configured harness and persists only pipeline bookkeeping. */
export async function interpretCapture(
  userId: string,
  captureId: string,
  db: Db = getDb(),
  providerOverride?: AiProvider,
): Promise<InterpretCaptureResult> {
  const capture = await getCapture(userId, captureId, db);
  if (!capture) throw new Error("Capture not found");
  if (capture.safetyStop || matchesRiskLanguage(capture.text)) {
    return { items: 0, droppedCount: 0, safetyStop: true };
  }

  const explicit = explicitTaskDraft(capture.text, capture.referenceDate);
  const parseFallback = () =>
    explicit ? [explicit] : parseCapture(capture.text, capture.referenceDate as IsoDate);
  const defaultProvider =
    process.env.LTS_AI_PROVIDER === "gateway" && !explicit
      ? new GatewayProvider()
      : new MockProvider([
          {
            kind: "output",
            output: { items: parseFallback() },
            raw: JSON.stringify({ items: parseFallback() }),
          },
        ]);
  const provider = providerOverride ?? defaultProvider;
  const model = process.env.LTS_AI_MODEL ?? "";
  const startedAt = Date.now();
  await db.delete(harnessRunPayloads).where(lt(harnessRunPayloads.expiresAt, new Date()));
  const result = await runHarness({
    userId,
    capture: capture.text,
    referenceDate: capture.referenceDate as IsoDate,
    timezone: capture.timezone,
    provider,
    model,
    parseFallback,
  });
  const drafts = result.drafts;

  let droppedCount = result.droppedCount;
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
  const rawPrompt = `${INTERPRET_SYSTEM_PROMPT}\n\n${result.promptVersion}\n\n${result.prompt}`;
  const rawOutput = result.rawOutput || JSON.stringify(drafts);
  const { mode, retentionDays } = traceSettings();
  await db.transaction(async (tx) => {
    await tx.insert(harnessRuns).values({
      id: runId,
      userId,
      captureId,
      provider: result.provider,
      model: result.model,
      promptVersion: result.promptVersion,
      promptSha256: digest(rawPrompt),
      outputSha256: digest(rawOutput),
      status: result.status,
      latencyMs: Math.max(Date.now() - startedAt, 0),
      validationErrorCodes: [
        ...new Set([...result.errorCodes, ...(droppedCount > 0 ? ["invalid_drafts_dropped"] : [])]),
      ],
      proposalItemIds: accepted.map((item) => item.id),
      toolCalls: result.toolCalls,
    });

    if (mode === "full") {
      const expiresAt = new Date(Date.now() + retentionDays * 86_400_000);
      await tx.insert(harnessRunPayloads).values({
        userId,
        harnessRunId: runId,
        rawPrompt,
        rawOutput,
        expiresAt,
      });
    }

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
          source: result.source,
          model: result.source === "model" ? result.model : null,
          promptVersion: result.promptVersion,
          confidence: draft.confidence,
          quote: draft.quote,
        })),
      );
    }
  });

  return { items: accepted.length, droppedCount, safetyStop: false };
}
