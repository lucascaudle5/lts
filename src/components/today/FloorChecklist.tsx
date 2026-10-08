"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "cn";
import { useState, useTransition } from "react";

import type { FloorItem, RoutineItem } from "./model";

type Act = (input: unknown) => Promise<{ ok: boolean; message: string }>;

const smallButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 motion-safe:active:scale-[0.98]";

/**
 * The floor: the few small things that keep tomorrow easy. One tap does the small version, and
 * the row settles into a single line. No tallies.
 */
export function FloorChecklist({
  date,
  floor,
  routines,
  act,
}: {
  date: string;
  floor: FloorItem[];
  routines: RoutineItem[];
  act: Act;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());

  function save(key: string, record: Record<string, unknown>) {
    start(async () => {
      const result = await act({ op: "record.save", record });
      if (result.ok) {
        setDone((prev) => new Set(prev).add(key));
        setError("");
        router.refresh();
      } else {
        setError("That didn't save. Your data is fine. Try again?");
      }
    });
  }

  const remaining = floor.filter((f) => !f.done && !done.has(f.id)).length;

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="floor-title"
        data-room="practice"
        className="space-y-3 rounded-2xl border border-t-4 border-t-room bg-card p-4 shadow-paper sm:p-5"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="floor-title" className="text-xl leading-7">
            {floor.length === 0
              ? "Your floor"
              : remaining === 0
                ? "Your floor is covered today"
                : `Your floor: ${floor.length} small ${floor.length === 1 ? "thing" : "things"} for today`}
          </h2>
          <Link
            href="/habits"
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Habits
          </Link>
        </div>
        {floor.length === 0 ? (
          <p className="text-sm text-ink-soft">
            A floor habit is something small enough to do on your worst day. Add one when you want
            tomorrow to be easier.
          </p>
        ) : (
          <ul className="space-y-2">
            {floor.map((item) => {
              const finished = item.done || done.has(item.id);
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors duration-300 motion-reduce:transition-none",
                    finished ? "border-room/40 bg-room-soft" : "bg-surface-2",
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium break-words">{item.title}</p>
                    {item.anchor ? (
                      <p className="font-mono text-xs text-muted-foreground">{item.anchor}</p>
                    ) : null}
                  </div>
                  {finished ? (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-room-ink">
                      <Check aria-hidden className="size-4" strokeWidth={2.25} />
                      Done. That counts.
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      className={smallButton}
                      onClick={() =>
                        save(item.id, {
                          type: "habit_log",
                          title: item.title,
                          notes: "",
                          habitId: item.id,
                          date,
                          outcome: "done",
                          value: item.target,
                        })
                      }
                    >
                      Do the small version
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {routines.length > 0 ? (
        <section
          aria-labelledby="routines-title"
          data-room="practice"
          className="space-y-3 rounded-2xl border border-t-4 border-t-room bg-surface-2 p-4 shadow-paper sm:p-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="routines-title" className="text-xl leading-7">
              Routines for today
            </h2>
            <Link
              href="/routines"
              className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            >
              Open routines
            </Link>
          </div>
          <ul className="space-y-2">
            {routines.map((routine) => {
              const finished = routine.loggedLabel !== null || done.has(routine.id);
              return (
                <li
                  key={routine.id}
                  className={cn(
                    "space-y-2 rounded-xl border px-4 py-3 transition-colors duration-300 motion-reduce:transition-none",
                    finished ? "border-room/40 bg-room-soft" : "bg-card",
                  )}
                >
                  <div>
                    <p className="font-medium">{routine.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {[
                        routine.anchor,
                        finished ? null : `Small version: ${routine.minimum.join(" → ")}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {finished ? (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-room-ink">
                      <Check aria-hidden className="size-4" strokeWidth={2.25} />
                      Done. That counts.
                      {routine.loggedLabel ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {routine.loggedLabel}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      className={smallButton}
                      onClick={() =>
                        save(routine.id, {
                          type: "routine_run",
                          title: routine.title,
                          notes: "",
                          routineId: routine.id,
                          date,
                          variant: "minimum",
                          outcome: "done",
                          completedSteps: routine.minimum,
                        })
                      }
                    >
                      Do the small version
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p role="status" className="rounded-lg border bg-card px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
