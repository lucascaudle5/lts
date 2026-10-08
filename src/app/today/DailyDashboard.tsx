"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { parseISO } from "date-fns";
import type { LifeRow, RecordOf, LifeType, WorkspaceData } from "@/contracts/life";

const button =
  "inline-flex min-h-10 items-center justify-center rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";
const section = "space-y-3 rounded-2xl border bg-card p-4 sm:p-5";
function records<T extends LifeType>(data: WorkspaceData, type: T) {
  return data.records.filter((r) => !r.archivedAt && r.data.type === type) as Array<
    LifeRow & { data: RecordOf<T> }
  >;
}

export function DailyDashboard({
  data,
  act,
}: {
  data: WorkspaceData;
  act: (input: unknown) => Promise<{ ok: boolean; message: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const today = data.today;
  const day = parseISO(today).getDay();
  const habits = records(data, "habit")
    .filter((h) => h.data.days.includes(day))
    .sort((a, b) => Number(a.data.tier === "optional") - Number(b.data.tier === "optional"));
  const routines = records(data, "routine").filter((r) => r.data.days.includes(day));
  const projects = records(data, "project").filter((p) => p.data.status === "active");
  const bills = records(data, "money").filter(
    (r) => r.data.direction === "bill" && !r.data.paid && r.data.date <= today,
  );
  const meals = records(data, "meal").filter((r) => r.data.date === today);
  const workouts = records(data, "workout").filter((r) => r.data.date === today);
  const states = records(data, "state").filter((r) => r.data.date === today);
  function save(input: unknown) {
    start(async () => {
      const result = await act(input);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link className={section} href="/tasks">
          <p className="text-xs text-muted-foreground">Due work</p>
          <p className="text-2xl font-semibold">
            {
              data.tasks.filter(
                (t) => !t.archivedAt && t.status === "open" && t.dueOn && t.dueOn <= today,
              ).length
            }
          </p>
          <p className="text-xs text-muted-foreground">Due today or earlier</p>
        </Link>
        <Link className={section} href="/habits">
          <p className="text-xs text-muted-foreground">Floor</p>
          <p className="text-2xl font-semibold">
            {
              habits.filter(
                (h) =>
                  h.data.tier === "floor" &&
                  records(data, "habit_log").some(
                    (l) =>
                      l.data.habitId === h.id && l.data.date === today && l.data.outcome === "done",
                  ),
              ).length
            }{" "}
            / {habits.filter((h) => h.data.tier === "floor").length}
          </p>
          <p className="text-xs text-muted-foreground">Defined minimums completed today</p>
        </Link>
        <Link className={section} href="/diet">
          <p className="text-xs text-muted-foreground">Meals</p>
          <p className="text-2xl font-semibold">{meals.length}</p>
          <p className="text-xs text-muted-foreground">Logged today · protect a meal window</p>
        </Link>
        <Link className={section} href="/fitness">
          <p className="text-xs text-muted-foreground">Movement</p>
          <p className="text-2xl font-semibold">
            {workouts.filter((w) => w.data.outcome === "done").length}
          </p>
          <p className="text-xs text-muted-foreground">Completed sessions today</p>
        </Link>
      </div>
      {message && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {message}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={section}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Floor and habits</h2>
            <Link href="/habits" className="text-sm underline">
              Manage
            </Link>
          </div>
          {habits.length ? (
            habits.map((habit) => {
              const log = records(data, "habit_log").find(
                (l) => l.data.habitId === habit.id && l.data.date === today,
              );
              return (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                  key={habit.id}
                >
                  <div>
                    <p className="text-sm font-medium">{habit.data.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {habit.data.tier} ·{" "}
                      {habit.data.anchor || `${habit.data.target} ${habit.data.unit}`}
                      {log ? ` · ${log.data.outcome}` : ""}
                    </p>
                  </div>
                  {!log && (
                    <button
                      disabled={pending}
                      className={button}
                      onClick={() =>
                        save({
                          op: "record.save",
                          record: {
                            type: "habit_log",
                            title: habit.data.title,
                            notes: "",
                            habitId: habit.id,
                            date: today,
                            outcome: "done",
                            value: habit.data.target,
                          },
                        })
                      }
                    >
                      Complete minimum
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              Add a floor habit that makes tomorrow easier.
            </p>
          )}
        </section>
        <section className={section}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Relevant routines</h2>
            <Link href="/routines" className="text-sm underline">
              Run a routine
            </Link>
          </div>
          {routines.length ? (
            routines.map((routine) => {
              const log = records(data, "routine_run").find(
                (l) => l.data.routineId === routine.id && l.data.date === today,
              );
              return (
                <div key={routine.id} className="space-y-2 rounded-xl border p-3">
                  <p className="text-sm font-medium">{routine.data.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {routine.data.anchor}
                    {log
                      ? ` · ${log.data.variant}: ${log.data.outcome}`
                      : ` · Minimum: ${routine.data.minimum.join(" → ")}`}
                  </p>
                  {!log && (
                    <button
                      disabled={pending}
                      className={button}
                      onClick={() =>
                        save({
                          op: "record.save",
                          record: {
                            type: "routine_run",
                            title: routine.data.title,
                            notes: "",
                            routineId: routine.id,
                            date: today,
                            variant: "minimum",
                            outcome: "done",
                            completedSteps: routine.data.minimum,
                          },
                        })
                      }
                    >
                      I completed the minimum
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              Define a routine with a smaller version for busy days.
            </p>
          )}
        </section>
        <section className={section}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Current priorities</h2>
            <Link href="/projects" className="text-sm underline">
              Projects
            </Link>
          </div>
          {projects.length ? (
            projects
              .sort((a, b) => Number(b.data.frontier) - Number(a.data.frontier))
              .map((p) => (
                <div key={p.id} className="rounded-xl border p-3">
                  <p className="text-sm font-medium">
                    {p.data.title}
                    {p.data.frontier ? " · Frontier" : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.data.nextAction || "Choose a next action"}
                  </p>
                </div>
              ))
          ) : (
            <p className="text-sm text-muted-foreground">Choose a project and its next action.</p>
          )}
          {bills.map((b) => (
            <Link href="/money" key={b.id} className="block rounded-xl border p-3 text-sm">
              Payment due: {b.data.title} · {b.data.currency} {b.data.amount.toFixed(2)}
            </Link>
          ))}
        </section>
        <section className={section}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Reported state and recovery</h2>
            <Link href="/mind" className="text-sm underline">
              Log a note
            </Link>
          </div>
          {states.map((state) => (
            <p className="text-sm" key={state.id}>
              {[
                state.data.sleepHours === null ? "" : `${state.data.sleepHours} hours sleep`,
                state.data.energy,
                state.data.mood,
                state.data.capacity,
              ]
                .filter(Boolean)
                .join(" · ")}
              {state.data.notes ? ` · ${state.data.notes}` : ""}
            </p>
          ))}
          {!states.length && (
            <p className="text-sm text-muted-foreground">No state note logged today.</p>
          )}
          <p className="text-sm text-muted-foreground">
            If something was missed, choose a minimum, move it, or intentionally skip.
          </p>
          <Link href="/review" className={button}>
            Review evidence and recovery options
          </Link>
        </section>
      </div>
      <section className={section}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent changes</h2>
          <Link href="/history" className="text-sm underline">
            Inspect / undo
          </Link>
        </div>
        {data.history.slice(0, 5).map((change) => {
          const after = change.after as { title?: string; data?: { title?: string } } | null;
          return (
            <p className="text-sm" key={change.id}>
              {after?.data?.title ?? after?.title ?? change.entityType} · {change.action} ·{" "}
              {change.origin}
            </p>
          );
        })}
        {!data.history.length && (
          <p className="text-sm text-muted-foreground">
            Your approved captures and manual changes will appear here.
          </p>
        )}
      </section>
    </div>
  );
}
