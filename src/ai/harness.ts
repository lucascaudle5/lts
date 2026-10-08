import { createHash } from "node:crypto";

import {
  ObservationRecordDraft,
  ScheduleBlockCreateDraft,
  SubmitProposals,
  TaskCreateDraft,
  type ProposalDraft,
} from "@/contracts/proposals";
import { GetTodayInput, ListOpenTasksInput, ToolName } from "@/contracts/tools";
import { addDaysIso } from "@/domain/dates";
import { findDateExpressions, parseTimeRange } from "@/domain/dates";
import { checkDraftSafety } from "@/domain/safety";
import { InvalidProviderOutputError, type AiProvider, type ProviderMessage } from "@/ai/provider";
import {
  makeInterpretPrompt,
  INTERPRET_SYSTEM_PROMPT,
  PROMPT_VERSION,
} from "@/ai/prompts/interpret";
import { executeReadTool, getProviderTools } from "@/server/tools";
import { getTodayTool } from "@/server/tools/getToday";
import { listOpenTasksTool } from "@/server/tools/listOpenTasks";

export const MAX_TOOL_ROUNDS = 4;

export interface HarnessInput {
  userId: string;
  capture: string;
  referenceDate: string;
  timezone: string;
  provider: AiProvider;
  model: string;
  parseFallback: () => ProposalDraft[];
}

export interface HarnessResult {
  drafts: ProposalDraft[];
  droppedCount: number;
  provider: string;
  source: "model" | "parser";
  model: string | null;
  status: "succeeded" | "fell_back";
  errorCodes: string[];
  toolCalls: Array<{ name: string; args: unknown; rowCount: number; returnedIds: string[] }>;
  prompt: string;
  rawOutput: string;
  promptVersion: string;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function inputError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 600) : "Invalid tool input";
}

function renderMessages(messages: ProviderMessage[]): string {
  return messages.map(({ role, content }) => `${role.toUpperCase()}: ${content}`).join("\n\n");
}

function parseOutput(value: unknown): { drafts: ProposalDraft[]; raw: string } {
  const candidate = typeof value === "string" ? JSON.parse(value) : value;
  const parsed = SubmitProposals.parse(candidate);
  return { drafts: parsed.items, raw: typeof value === "string" ? value : JSON.stringify(value) };
}

function normalizeExplicitValues(draft: ProposalDraft, referenceDate: string): ProposalDraft {
  const dates = findDateExpressions(draft.quote, referenceDate).map(({ date }) => date);
  if (draft.kind === "schedule_block.create") {
    const explicitTime = parseTimeRange(draft.quote);
    const payload = ScheduleBlockCreateDraft.parse({
      ...draft.payload,
      ...(dates.length > 0 && !dates.includes(draft.payload.date ?? "") ? { date: dates[0] } : {}),
      ...(explicitTime?.start ? { start: explicitTime.start } : {}),
      ...(explicitTime?.end ? { end: explicitTime.end } : {}),
    });
    return { ...draft, payload };
  }
  if (draft.kind === "task.create") {
    const payload = TaskCreateDraft.parse({
      ...draft.payload,
      ...(dates.length > 0 && !dates.includes(draft.payload.dueOn ?? "")
        ? { dueOn: dates[0] }
        : {}),
    });
    return { ...draft, payload };
  }
  const payload = ObservationRecordDraft.parse({
    ...draft.payload,
    ...(dates.length > 0 && !dates.includes(draft.payload.occurredOn ?? "")
      ? { occurredOn: dates[0] }
      : {}),
  });
  return { ...draft, payload };
}

function filterSafety(drafts: ProposalDraft[], capture: string, referenceDate: string) {
  const safe: ProposalDraft[] = [];
  let dropped = 0;
  for (const draft of drafts.map((item) => normalizeExplicitValues(item, referenceDate))) {
    if (checkDraftSafety(draft, capture).length > 0) dropped += 1;
    else safe.push(draft);
  }
  return { drafts: safe, dropped };
}

/** Provider-independent bounded loop. No provider or tool can write domain state. */
export async function runHarness(input: HarnessInput): Promise<HarnessResult> {
  const capabilities = input.provider.capabilities(input.model);
  const prompt = makeInterpretPrompt({
    capture: input.capture,
    referenceDate: input.referenceDate,
    timezone: input.timezone,
  });
  const messages: ProviderMessage[] = [{ role: "user", content: prompt }];
  const tools = capabilities.toolCalling ? getProviderTools() : {};
  const toolCalls: HarnessResult["toolCalls"] = [];
  const errors: string[] = [];
  const outputs: string[] = [];
  let invalidOutputRetries = 0;

  try {
    if (!capabilities.toolCalling) {
      const today = await getTodayTool(
        input.userId,
        GetTodayInput.parse({ date: input.referenceDate }),
        input.timezone,
      );
      const openTasks = await listOpenTasksTool(
        input.userId,
        ListOpenTasksInput.parse({ limit: 50 }),
      );
      const context = {
        date: input.referenceDate,
        blocks: [...today.blocks],
        openTaskCount: today.openTaskCount,
        openTasks: [...openTasks.tasks],
        nextDate: addDaysIso(input.referenceDate, 1),
      };
      const maxContextChars = Math.max((capabilities.maxContextTokens - 2_000) * 4, 1_000);
      while (JSON.stringify(context).length > maxContextChars) {
        if (context.openTasks.length >= context.blocks.length && context.openTasks.length > 0) {
          context.openTasks.pop();
        } else if (context.blocks.length > 0) {
          context.blocks.pop();
        } else break;
      }
      const contextMessage = JSON.stringify(context);
      messages[0] = { role: "user", content: `${prompt}\n\nSnapshot:\n${contextMessage}` };
    }

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      let response;
      try {
        response = await input.provider.generate({
          model: input.model,
          system: INTERPRET_SYSTEM_PROMPT,
          messages,
          tools,
          ...(!capabilities.toolCalling && capabilities.structuredOutput
            ? { outputSchema: SubmitProposals }
            : {}),
        });
      } catch (error) {
        if (!(error instanceof InvalidProviderOutputError)) throw error;
        errors.push("invalid_output");
        if (invalidOutputRetries >= 1) break;
        invalidOutputRetries += 1;
        messages.push({
          role: "assistant",
          content: `${error.message}. Return a corrected result.`,
        });
        continue;
      }
      if (response.kind === "output") {
        outputs.push(response.raw);
        let parsed: ReturnType<typeof parseOutput>;
        try {
          parsed = parseOutput(response.output);
        } catch (error) {
          errors.push("invalid_output");
          if (invalidOutputRetries < 1) {
            invalidOutputRetries += 1;
            messages.push({
              role: "assistant",
              content: `Your prior output did not match SubmitProposals: ${inputError(error)}. Return a corrected result.`,
            });
            continue;
          }
          break;
        }
        const filtered = filterSafety(parsed.drafts, input.capture, input.referenceDate);
        return {
          drafts: filtered.drafts,
          droppedCount: filtered.dropped,
          provider: input.provider.name,
          source: response.source ?? "model",
          model: input.model || null,
          status: "succeeded",
          errorCodes: filtered.dropped ? ["unsafe_drafts_dropped"] : errors,
          toolCalls,
          prompt: renderMessages(messages),
          rawOutput: response.raw,
          promptVersion: PROMPT_VERSION,
        };
      }

      for (const call of response.calls) {
        const name = ToolName.safeParse(call.name);
        if (!name.success) {
          errors.push("tool_not_allowlisted");
          toolCalls.push({ name: call.name, args: null, rowCount: 0, returnedIds: [] });
          messages.push({ role: "assistant", content: `Rejected unavailable tool ${call.name}.` });
          continue;
        }
        if (call.name === "submit_proposals") {
          try {
            const parsed = parseOutput(call.input);
            outputs.push(JSON.stringify(call.input));
            const filtered = filterSafety(parsed.drafts, input.capture, input.referenceDate);
            toolCalls.push({
              name: "submit_proposals",
              args: { itemCount: parsed.drafts.length },
              rowCount: parsed.drafts.length,
              returnedIds: [],
            });
            return {
              drafts: filtered.drafts,
              droppedCount: filtered.dropped,
              provider: input.provider.name,
              source: response.source ?? "model",
              model: input.model || null,
              status: "succeeded",
              errorCodes: filtered.dropped ? [...errors, "unsafe_drafts_dropped"] : errors,
              toolCalls,
              prompt: renderMessages(messages),
              rawOutput: outputs.join("\n"),
              promptVersion: PROMPT_VERSION,
            };
          } catch (error) {
            errors.push("invalid_proposals");
            messages.push({
              role: "assistant",
              content: `submit_proposals was invalid: ${inputError(error)}`,
            });
            continue;
          }
        }
        try {
          const result = await executeReadTool(call.name, call.input, {
            userId: input.userId,
            timezone: input.timezone,
            referenceDate: input.referenceDate,
          });
          toolCalls.push({
            name: call.name,
            args: result.validatedInput,
            rowCount: result.rowCount,
            returnedIds: result.returnedIds,
          });
          messages.push({
            role: "assistant",
            content: `${call.name} result: ${JSON.stringify(result.output)}`,
          });
        } catch (error) {
          errors.push(
            call.name === "get_recent_observations" ? "sensitive_tool_denied" : "invalid_tool_call",
          );
          toolCalls.push({ name: call.name, args: null, rowCount: 0, returnedIds: [] });
          messages.push({
            role: "assistant",
            content: `${call.name} rejected: ${inputError(error)}`,
          });
        }
      }
    }
    errors.push("tool_round_limit");
  } catch (error) {
    errors.push(`provider_error:${hash(inputError(error)).slice(0, 16)}`);
  }

  const fallback = filterSafety(input.parseFallback(), input.capture, input.referenceDate);
  return {
    drafts: fallback.drafts,
    droppedCount: fallback.dropped,
    provider: input.provider.name,
    source: "parser",
    model: input.model || null,
    status: "fell_back",
    errorCodes: [...new Set(errors.length ? errors : ["invalid_output"])],
    toolCalls,
    prompt: renderMessages(messages),
    rawOutput: outputs.join("\n"),
    promptVersion: PROMPT_VERSION,
  };
}
