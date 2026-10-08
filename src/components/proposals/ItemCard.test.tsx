import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ProposalItem } from "@/contracts/proposals";

import { ItemCard, statusWords } from "./ItemCard";

const UUID = "00000000-0000-4000-8000-000000000001";
const noop = () => {};

function item(extra: Record<string, unknown>): ProposalItem {
  return {
    id: UUID,
    status: "ready",
    kind: "schedule_block.create",
    payload: {
      title: "Dentist",
      blockKind: "personal",
      date: "2026-10-09",
      start: "15:00",
      end: "16:00",
      fixed: true,
    },
    missingSlots: [],
    warnings: [],
    provenance: { source: "parser", quote: "Dentist Friday 3-4pm", confidence: "high" },
    ...extra,
  } as ProposalItem;
}

function render(i: ProposalItem) {
  return renderToStaticMarkup(
    <ItemCard
      item={i}
      captureId={UUID}
      updateAction={noop}
      approveAction={noop}
      rejectAction={noop}
    />,
  );
}

const visible = (html: string) => html.replace(/<script[\s\S]*?<\/script>|<[^>]*>/g, " ");

describe("ItemCard", () => {
  it("says what will change in plain words, tinted by kind, with no internal names", () => {
    const html = render(item({}));
    expect(html).toContain("Add to your schedule");
    expect(html).toContain("What will change");
    expect(html).toContain("Dentist");
    expect(html).toContain("2026-10-09");
    expect(html).toContain("[--k:var(--");
    expect(visible(html)).not.toMatch(/schedule_block|task\.create|needs_input/);
  });

  it("makes approve the gold primary and rejecting a quiet ghost", () => {
    const html = render(item({}));
    expect(html).toContain("Approve this change");
    expect(html).toContain("bg-gold");
    expect(html).toContain("Not this one");
    expect(html).not.toContain(">Reject<");
    expect(html.indexOf("Approve this change")).toBeLessThan(html.indexOf("Not this one"));
    expect(html).toContain("w-full");
  });

  it("names a gap as a need, never as a failure", () => {
    const missing = item({
      status: "needs_input",
      payload: { title: "Dentist", fixed: true },
      missingSlots: [{ path: "start", reason: "What time does it start?" }],
    });
    expect(statusWords(missing)).toEqual({ text: "Needs a time", tone: "wait" });
    const html = render(missing);
    expect(html).toContain("Needs a time");
    expect(html).not.toContain("Approve this change");
    expect(visible(html)).not.toMatch(/(?:error|invalid|failed|red)/i);
  });

  it("uses plain words for every status", () => {
    const words = (status: string) => statusWords(item({ status })).text;
    expect(words("ready")).toBe("Ready to add");
    expect(words("applied")).toBe("Added");
    expect(words("rejected")).toBe("Set aside");
    expect(words("failed")).toBe("Couldn't add this one");
  });

  it("shows a note back in the person's own words", () => {
    const html = render(
      item({
        kind: "observation.record",
        payload: { category: "energy", valueText: "slept badly", occurredOn: "2026-10-08" },
      }),
    );
    expect(html).toContain("Keep what you said");
    expect(html).toContain("slept badly");
  });
});
