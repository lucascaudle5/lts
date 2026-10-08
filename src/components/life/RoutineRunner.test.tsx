import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LifeRecord, LifeRow, RecordOf } from "@/contracts/life";

import { closingLine, RoutineRunner } from "./RoutineRunner";

const UUID = "00000000-0000-4000-8000-000000000001";

const routine = {
  id: UUID,
  archivedAt: null,
  createdAt: "",
  updatedAt: "",
  data: {
    type: "routine",
    title: "Evening wind-down",
    notes: "",
    anchor: "after dinner",
    days: [0, 1, 2, 3, 4, 5, 6],
    full: ["Dishes", "Tidy desk", "Stretch", "Journal"],
    short: ["Tidy desk", "Stretch"],
    minimum: ["Lights low"],
    minutes: 20,
  },
} as unknown as LifeRow & { data: RecordOf<"routine"> };

function render(logs: Array<LifeRow & { data: RecordOf<"routine_run"> }> = []) {
  return renderToStaticMarkup(
    <RoutineRunner
      routine={routine}
      date="2026-10-08"
      logs={logs}
      save={(_: LifeRecord) => {}}
      pending={false}
    />,
  );
}

function log(variant: "full" | "short" | "minimum", outcome: "done" | "partial" | "skipped") {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
    data: {
      type: "routine_run",
      title: "Evening wind-down",
      notes: "",
      routineId: UUID,
      date: "2026-10-08",
      variant,
      outcome,
      completedSteps: [],
    },
  } as unknown as LifeRow & { data: RecordOf<"routine_run"> };
}

describe("RoutineRunner", () => {
  it("offers Full, Short and Minimum as equal chips, with the minimum always visible", () => {
    const html = render();
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    for (const text of ["Full", "Short", "Minimum", "4 steps", "2 steps", "1 step"]) {
      expect(html).toContain(text);
    }
    const chips = html.match(/<span class="flex min-h-11 cursor-pointer[^"]*"/g) ?? [];
    expect(chips).toHaveLength(3);
    expect(new Set(chips).size).toBe(1);
  });

  it("completes the minimum in two taps: pick the chip, then mark it done", () => {
    const html = render();
    expect(html).toContain("Mark full done");
    expect(html).toContain("Stop here");
    expect(html).toContain("Not today");
    expect(html).not.toMatch(/Skip intentionally|Save partial|Complete full/);
  });

  it("shows step progress without a score", () => {
    const html = render();
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemax="4"');
    expect(html).toContain('aria-valuenow="0"');
  });

  it("settles into 'Done. That counts.' with the version name", () => {
    const html = render([log("minimum", "done")]);
    expect(html).toContain("Done. That counts. Minimum version.");
    expect(html).not.toContain("Mark ");
  });

  it("leaves a way forward after every outcome", () => {
    const min = routine.data.minimum;
    expect(closingLine({ variant: "short", outcome: "done" }, min).headline).toMatch(/That counts/);
    const partial = closingLine({ variant: "full", outcome: "partial" }, min);
    expect(partial.headline).toBe("Stopped here. That counts.");
    expect(partial.next).toContain("minimum version is always there");
    expect(partial.next).toContain("Lights low");
    const skipped = closingLine({ variant: "full", outcome: "skipped" }, min);
    expect(skipped.headline).toBe("Not today. That's fine.");
    expect(skipped.next).toContain("only 1 step");
    for (const text of [partial.next, skipped.next, partial.headline, skipped.headline]) {
      expect(text).not.toMatch(/miss|fail|streak|score|behind|should/i);
    }
  });
});
