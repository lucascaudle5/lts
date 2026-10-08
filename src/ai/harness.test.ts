import { describe, expect, it } from "vitest";

import { runHarness, MAX_TOOL_ROUNDS } from "@/ai/harness";
import { MockProvider } from "@/ai/providers/mock";
import type { ProposalDraft } from "@/contracts/proposals";
import goldenFixtures from "@/ai/fixtures/golden.json";

const draft: ProposalDraft = {
  kind: "task.create",
  payload: { title: "buy groceries", taskKind: "errand" },
  quote: "need to buy groceries",
  confidence: "high",
};

function output(items: ProposalDraft[]) {
  const value = { items };
  return { kind: "output" as const, output: value, raw: JSON.stringify(value) };
}

const base = {
  userId: "5a5a5a5a-0000-4000-8000-000000000001",
  capture: "need to buy groceries",
  referenceDate: "2026-10-08",
  timezone: "America/Chicago",
  model: "mock",
  parseFallback: () => [draft],
};

describe("AI harness", () => {
  it("runs every golden fixture through the offline mock provider", async () => {
    expect(goldenFixtures.length).toBeGreaterThanOrEqual(20);
    for (const fixture of goldenFixtures) {
      const provider = new MockProvider([
        {
          kind: "output",
          output: fixture.expected,
          raw: JSON.stringify(fixture.expected),
        },
      ]);
      const result = await runHarness({
        ...base,
        capture: fixture.capture,
        referenceDate: fixture.referenceDate ?? base.referenceDate,
        timezone: fixture.timezone ?? base.timezone,
        provider,
        parseFallback: () => [],
      });
      expect(result.drafts, fixture.id).toEqual(fixture.expected.items);
    }
  });

  it("returns only schema-valid proposals from the submit tool", async () => {
    const provider = new MockProvider([
      { kind: "tool_calls", calls: [{ name: "submit_proposals", input: { items: [draft] } }] },
    ]);
    await expect(runHarness({ ...base, provider })).resolves.toMatchObject({
      drafts: [draft],
      status: "succeeded",
      source: "parser",
    });
  });

  it("uses deterministic date and time parsing when the note states them explicitly", async () => {
    const capture = "dentist friday 3-4pm";
    const provider = new MockProvider([
      output([
        {
          kind: "schedule_block.create",
          payload: {
            title: "Dentist",
            blockKind: "personal",
            date: "2026-10-10",
            start: "12:00",
            end: "13:00",
            fixed: true,
          },
          quote: capture,
          confidence: "high",
        },
      ]),
    ]);
    const result = await runHarness({ ...base, capture, provider });
    expect(result.drafts).toMatchObject([
      {
        kind: "schedule_block.create",
        payload: { date: "2026-10-09", start: "15:00", end: "16:00" },
      },
    ]);
  });

  it("retries invalid output once and then falls back to the parser", async () => {
    const provider = new MockProvider([
      { kind: "output", output: "{bad json", raw: "{bad json" },
      { kind: "output", output: { items: [{ kind: "invalid" }] }, raw: "{invalid schema}" },
    ]);
    await expect(runHarness({ ...base, provider })).resolves.toMatchObject({
      drafts: [draft],
      status: "fell_back",
      source: "parser",
    });
    expect(provider.requests).toHaveLength(2);
  });

  it("falls back visibly when the provider fails", async () => {
    const provider = new MockProvider([new Error("provider unavailable")]);
    await expect(runHarness({ ...base, provider })).resolves.toMatchObject({
      drafts: [draft],
      status: "fell_back",
      source: "parser",
      errorCodes: [expect.stringMatching(/^provider_error:/)],
    });
  });

  it("rejects tool names outside the allowlist", async () => {
    const provider = new MockProvider([
      { kind: "tool_calls", calls: [{ name: "write_to_database", input: {} }] },
      { kind: "tool_calls", calls: [{ name: "submit_proposals", input: { items: [draft] } }] },
    ]);
    await expect(runHarness({ ...base, provider })).resolves.toMatchObject({
      drafts: [draft],
      errorCodes: ["tool_not_allowlisted"],
    });
  });

  it("rejects tool arguments beyond the declared limits", async () => {
    const provider = new MockProvider([
      {
        kind: "tool_calls",
        calls: [
          { name: "get_schedule", input: { from: "2026-10-08", to: "2026-11-08" } },
          { name: "submit_proposals", input: { items: [draft] } },
        ],
      },
    ]);
    await expect(runHarness({ ...base, provider })).resolves.toMatchObject({
      drafts: [draft],
      errorCodes: ["invalid_tool_call"],
      toolCalls: [
        { name: "get_schedule", args: null, rowCount: 0, returnedIds: [] },
        { name: "submit_proposals", args: { itemCount: 1 }, rowCount: 1, returnedIds: [] },
      ],
    });
  });

  it("stops after four tool rounds", async () => {
    const provider = new MockProvider(
      Array.from({ length: MAX_TOOL_ROUNDS }, () => ({
        kind: "tool_calls" as const,
        calls: [{ name: "submit_proposals", input: { items: "invalid" } }],
      })),
    );
    await expect(runHarness({ ...base, provider })).resolves.toMatchObject({
      drafts: [draft],
      status: "fell_back",
      errorCodes: ["invalid_proposals", "tool_round_limit"],
    });
    expect(provider.requests).toHaveLength(MAX_TOOL_ROUNDS);
  });

  it("drops ungrounded or unsafe drafts before returning", async () => {
    const provider = new MockProvider([
      output([
        { ...draft, quote: "a quote that was not in the capture" },
        {
          ...draft,
          quote: "need to buy groceries",
          payload: { title: "diagnose ADHD", taskKind: "other" },
        },
      ]),
    ]);
    await expect(runHarness({ ...base, provider })).resolves.toMatchObject({
      drafts: [],
      droppedCount: 2,
      errorCodes: ["unsafe_drafts_dropped"],
    });
  });

  it("never invokes a domain write path", async () => {
    const provider = new MockProvider([
      { kind: "tool_calls", calls: [{ name: "submit_proposals", input: { items: [draft] } }] },
    ]);
    const result = await runHarness({ ...base, provider });
    expect(result.drafts).toEqual([draft]);
    expect(provider.requests[0]?.tools).not.toHaveProperty("runMutations");
  });
});
