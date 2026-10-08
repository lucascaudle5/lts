"use client";

import { Check } from "lucide-react";
import { cn } from "cn";
import { useId, useState } from "react";

import type { LifeRecord, LifeRow, RecordOf } from "@/contracts/life";

import { RoomCard } from "./RoomCard";

type Variant = "full" | "short" | "minimum";
type Outcome = "done" | "partial" | "skipped";

const VARIANTS: readonly Variant[] = ["full", "short", "minimum"];
const LABEL: Record<Variant, string> = { full: "Full", short: "Short", minimum: "Minimum" };

const button =
  "inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium disabled:opacity-50";

function plural(n: number) {
  return `${n} ${n === 1 ? "step" : "steps"}`;
}

/** What the person sees once something is logged. Every outcome leaves a way forward. */
export function closingLine(
  log: { variant: Variant; outcome: Outcome },
  minimum: readonly string[],
): { headline: string; next: string } {
  const version = `${LABEL[log.variant]} version`;
  if (log.outcome === "done") {
    return { headline: `Done. That counts. ${version}.`, next: "" };
  }
  const smallest = minimum.length ? `Minimum: ${minimum.join(" → ")}.` : "";
  if (log.outcome === "partial") {
    return {
      headline: "Stopped here. That counts.",
      next: `The minimum version is always there when you want it. ${smallest}`.trim(),
    };
  }
  return {
    headline: "Not today. That's fine.",
    next: `Whenever it suits you, the minimum is only ${plural(minimum.length)}. ${smallest}`.trim(),
  };
}

export function RoutineRunner({
  routine,
  date,
  logs,
  save,
  pending,
}: {
  routine: LifeRow & { data: RecordOf<"routine"> };
  date: string;
  logs: Array<LifeRow & { data: RecordOf<"routine_run"> }>;
  save: (record: LifeRecord, id?: string) => void;
  pending: boolean;
}) {
  const [variant, setVariant] = useState<Variant>("full");
  const [completed, setCompleted] = useState<string[]>([]);
  const [reopened, setReopened] = useState(false);
  const group = useId();
  const steps = routine.data[variant];
  const log = logs.find((l) => l.data.routineId === routine.id && l.data.date === date);
  const settled = Boolean(log) && !reopened;
  const pct = steps.length ? Math.round((completed.length / steps.length) * 100) : 0;

  function submit(outcome: Outcome) {
    save(
      {
        type: "routine_run",
        title: routine.data.title,
        notes: "",
        routineId: routine.id,
        date,
        variant,
        outcome,
        completedSteps: outcome === "done" ? [...steps] : outcome === "skipped" ? [] : completed,
      },
      log?.id,
    );
    setReopened(false);
  }

  if (settled && log) {
    const closing = closingLine(log.data, routine.data.minimum);
    return (
      <RoomCard
        settled
        eyebrow={routine.data.anchor || "No anchor"}
        title={routine.data.title}
        footer={
          <button type="button" className={cn(button, "bg-card")} onClick={() => setReopened(true)}>
            Change it
          </button>
        }
      >
        <div role="status" className="space-y-1">
          <p className="flex items-center gap-1.5 font-medium text-room-ink">
            <Check aria-hidden className="size-4 shrink-0" strokeWidth={2.25} />
            {closing.headline}
          </p>
          {closing.next ? <p className="text-sm text-ink-soft">{closing.next}</p> : null}
        </div>
      </RoomCard>
    );
  }

  return (
    <RoomCard
      eyebrow={routine.data.anchor || "No anchor"}
      title={routine.data.title}
      footer={
        <>
          <button
            type="button"
            className={cn(button, "border-primary bg-primary text-primary-foreground")}
            disabled={pending}
            onClick={() => submit("done")}
          >
            Mark {variant} done
          </button>
          <button
            type="button"
            className={cn(button, "bg-card")}
            disabled={pending || !completed.length}
            onClick={() => submit("partial")}
          >
            Stop here
          </button>
          <button
            type="button"
            className={cn(button, "border-transparent text-ink-soft hover:bg-muted")}
            disabled={pending}
            onClick={() => submit("skipped")}
          >
            Not today
          </button>
        </>
      }
    >
      <fieldset className="m-0 grid min-w-0 grid-cols-3 gap-2 border-0 p-0">
        <legend className="sr-only">Which version fits today</legend>
        {VARIANTS.map((v) => (
          <label key={v} className="relative block">
            <input
              type="radio"
              name={group}
              value={v}
              checked={variant === v}
              onChange={() => {
                setVariant(v);
                setCompleted([]);
              }}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-line-strong/50 bg-surface-2 px-2 py-1.5 text-center text-sm font-medium",
                "peer-focus-visible:outline-focus peer-checked:border-room peer-checked:bg-room-soft peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
              )}
            >
              {LABEL[v]}
              <span className="font-mono text-[11px] font-normal text-muted-foreground">
                {plural(routine.data[v].length)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-2">
        <div
          role="progressbar"
          aria-label="Steps ticked"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={completed.length}
          className="h-2 overflow-hidden rounded-full bg-surface-3"
        >
          <div
            className="h-full rounded-full bg-room motion-safe:transition-[width] motion-safe:duration-[240ms] motion-safe:ease-[cubic-bezier(.2,.7,.3,1)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="space-y-1">
          {steps.map((step, i) => {
            const ticked = completed.includes(step);
            return (
              <li key={`${step}-${i}`}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 text-[15px]">
                  <input
                    type="checkbox"
                    checked={ticked}
                    onChange={(e) =>
                      setCompleted(
                        e.target.checked
                          ? [...completed, step]
                          : completed.filter((s) => s !== step),
                      )
                    }
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className="peer-focus-visible:outline-focus flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-line-strong bg-background text-transparent peer-checked:border-room peer-checked:bg-room peer-checked:text-card peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
                  >
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                  <span
                    className={cn(
                      "min-w-0 break-words transition-colors motion-reduce:transition-none",
                      ticked && "text-muted-foreground",
                    )}
                  >
                    {step}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {!steps.length ? (
          <p className="text-sm text-muted-foreground">
            This version has no steps yet. Edit the routine to add a few.
          </p>
        ) : null}
      </div>
    </RoomCard>
  );
}
