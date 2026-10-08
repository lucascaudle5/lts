import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

import { z } from "zod";

import { SubmitProposals } from "@/contracts/proposals";
import { GatewayProvider } from "@/ai/providers/gateway";
import { INTERPRET_SYSTEM_PROMPT, makeInterpretPrompt } from "@/ai/prompts/interpret";

const Fixture = z.object({
  id: z.string(),
  capture: z.string(),
  referenceDate: z.string().optional(),
  timezone: z.string().optional(),
  expected: SubmitProposals,
});

function flatten(value: unknown, prefix = ""): Map<string, string> {
  if (value === null || typeof value !== "object")
    return new Map([[prefix, JSON.stringify(value)]]);
  if (Array.isArray(value)) {
    return new Map(value.flatMap((item, index) => [...flatten(item, `${prefix}[${index}]`)]));
  }
  return new Map(
    Object.entries(value).flatMap(([key, child]) => [
      ...flatten(child, prefix ? `${prefix}.${key}` : key),
    ]),
  );
}

function score(expected: unknown, actual: unknown): { correct: number; fields: number } {
  const expectedFields = flatten(expected);
  const actualFields = flatten(actual);
  let correct = 0;
  for (const [path, value] of expectedFields) if (actualFields.get(path) === value) correct += 1;
  return { correct, fields: Math.max(expectedFields.size, actualFields.size) };
}

async function evaluateFixture(
  fixture: z.infer<typeof Fixture>,
  model: string,
): Promise<{ correct: number; fields: number; actual: unknown; issues?: unknown }> {
  const provider = new GatewayProvider();
  const response = await provider.generate({
    model,
    system: INTERPRET_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: makeInterpretPrompt({
          capture: fixture.capture,
          referenceDate: fixture.referenceDate ?? "2026-10-08",
          timezone: fixture.timezone ?? "America/Chicago",
        }),
      },
    ],
    tools: {
      submit_proposals: {
        description: "Return the proposal items for the user's note.",
        inputSchema: SubmitProposals,
      },
    },
  });
  const value =
    response.kind === "tool_calls"
      ? response.calls.find((call) => call.name === "submit_proposals")?.input
      : typeof response.output === "string"
        ? JSON.parse(response.output)
        : response.output;
  const parsed = SubmitProposals.safeParse(value);
  if (!parsed.success)
    return {
      correct: 0,
      fields: flatten(fixture.expected).size,
      actual: value,
      issues: parsed.error.issues,
    };
  return { ...score(fixture.expected, parsed.data), actual: parsed.data };
}

export async function runEval(model: string) {
  const fixturePath = new URL("./fixtures/golden.json", import.meta.url);
  const fixtures = z.array(Fixture).parse(JSON.parse(readFileSync(fixturePath, "utf8")));
  let correct = 0;
  let fields = 0;
  let failed = 0;
  const report: unknown[] = [];
  for (const fixture of fixtures) {
    // The current Gateway team limit is five requests/minute. Pacing avoids testing the quota.
    if (report.length > 0) await setTimeout(13_000);
    try {
      const result = await evaluateFixture(fixture, model);
      correct += result.correct;
      fields += result.fields;
      report.push({ fixture: fixture.id, ...result });
    } catch (error) {
      failed += 1;
      fields += flatten(fixture.expected).size;
      const failure = error as { name?: string; statusCode?: number; message?: string };
      report.push({
        fixture: fixture.id,
        error: failure.name,
        status: failure.statusCode,
        message: failure.message?.slice(0, 250),
      });
      console.log(
        `${fixture.id}: failed (${failure.name ?? "provider error"}${failure.statusCode ? ` ${failure.statusCode}` : ""})`,
      );
      continue;
    }
  }
  const accuracy = fields === 0 ? 0 : correct / fields;
  console.log(`AI fixture accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${fields} fields)`);
  if (failed > 0) console.log(`${failed} fixture${failed === 1 ? "" : "s"} failed to run.`);
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/ai-eval.json",
    JSON.stringify({ model, accuracy, correct, fields, failed, results: report }, null, 2),
  );
  return { accuracy, correct, fields, failed, fixtureCount: fixtures.length };
}
