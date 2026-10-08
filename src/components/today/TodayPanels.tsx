import Link from "next/link";

import type { LifeRow, RecordOf, WorkspaceData } from "@/contracts/life";
import type { TodayView } from "@/contracts/today";

import { BlockRow } from "./BlockRow";
import { OBSERVATION_CATEGORY_LABEL, TASK_KIND_LABEL } from "./labels";
import { ProvenanceLink } from "./ProvenanceLink";
import { EmptyLine, Section } from "./Section";

function records<T extends string>(data: WorkspaceData, type: T) {
  return data.records.filter((r) => !r.archivedAt && r.data.type === type) as Array<
    LifeRow & { data: RecordOf<never> }
  >;
}

const linkClass = "inline-flex min-h-11 items-center text-sm underline underline-offset-4";

/** The second layer: everything that is useful but not the next thing. Quiet panels, one hue each. */
export function TodayPanels({ view, data }: { view: TodayView; data: WorkspaceData }) {
  const projects = (
    records(data, "project") as unknown as Array<LifeRow & { data: RecordOf<"project"> }>
  )
    .filter((p) => p.data.status === "active")
    .sort((a, b) => Number(b.data.frontier) - Number(a.data.frontier));
  const bills = (
    records(data, "money") as unknown as Array<LifeRow & { data: RecordOf<"money"> }>
  ).filter((r) => r.data.direction === "bill" && !r.data.paid && r.data.date <= data.today);
  const states = (
    records(data, "state") as unknown as Array<LifeRow & { data: RecordOf<"state"> }>
  ).filter((r) => r.data.date === data.today);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section
        title="Tasks"
        room="plan"
        panel
        meta={view.openTasks.length > 0 ? String(view.openTasks.length) : undefined}
      >
        {view.openTasks.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border bg-card">
            {view.openTasks.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="leading-snug font-medium break-words">{task.title}</p>
                  <ProvenanceLink provenance={task.provenance} />
                  <p className="text-xs text-muted-foreground">
                    {TASK_KIND_LABEL[task.taskKind]} · {task.priority} priority
                  </p>
                </div>
                {task.dueLabel ? (
                  <span
                    className={
                      task.pastDue
                        ? "shrink-0 rounded-full bg-quiet-soft px-2.5 py-0.5 text-xs text-quiet"
                        : task.dueToday
                          ? "shrink-0 rounded-full bg-gold-soft px-2.5 py-0.5 text-xs text-gold-text"
                          : "shrink-0 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground"
                    }
                  >
                    {task.dueLabel}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine>Nothing waiting. Add a task from a note whenever one comes up.</EmptyLine>
        )}
        <Link className={linkClass} href="/tasks">
          Open tasks
        </Link>
      </Section>

      <Section title="Next 7 days" room="plan" panel>
        {view.upcoming.length > 0 ? (
          <div className="space-y-4">
            {view.upcoming.map((day) => (
              <div key={day.date} className="space-y-2">
                <h3 className="text-sm">{day.label}</h3>
                <ol className="space-y-2">
                  {day.blocks.map((block) => (
                    <BlockRow key={block.id} block={block} />
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : (
          <EmptyLine>The week ahead is open.</EmptyLine>
        )}
      </Section>

      <Section title="Projects and bills" room="plan" panel>
        {projects.length > 0 ? (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li
                key={p.id}
                className={
                  p.data.frontier
                    ? "rounded-xl border border-l-4 border-l-gold bg-card p-3 shadow-paper"
                    : "rounded-xl border bg-card p-3"
                }
              >
                {p.data.frontier ? <p className="eyebrow text-gold-text">Frontier</p> : null}
                <p className="font-medium">{p.data.title}</p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {p.data.nextAction || "Choose a next action"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine>Choose a project and its next action when you are ready.</EmptyLine>
        )}
        {bills.map((b) => (
          <Link
            href="/money"
            key={b.id}
            className="block rounded-xl border bg-card p-3 text-sm hover:bg-surface-3"
          >
            Payment due: {b.data.title} · {b.data.currency} {b.data.amount.toFixed(2)}
          </Link>
        ))}
        <Link className={linkClass} href="/projects">
          Open projects
        </Link>
      </Section>

      <Section title="In your words" room="self" panel>
        {view.observations.length === 0 && states.length === 0 ? (
          <EmptyLine>Nothing noted today. A line about how today is going is welcome.</EmptyLine>
        ) : (
          <ul className="space-y-2">
            {view.observations.map((o) => (
              <li key={o.id} className="rounded-lg border bg-card px-4 py-3">
                <p className="eyebrow text-muted-foreground">
                  {OBSERVATION_CATEGORY_LABEL[o.category]}
                </p>
                <p className="mt-1 font-heading text-[17px] leading-snug">
                  &ldquo;{o.valueText}&rdquo;
                </p>
                <ProvenanceLink provenance={o.provenance} />
              </li>
            ))}
            {states.map((state) => (
              <li key={state.id} className="rounded-lg border bg-card px-4 py-3 text-sm">
                {[
                  state.data.sleepHours === null ? "" : `${state.data.sleepHours} hours sleep`,
                  state.data.energy,
                  state.data.mood,
                  state.data.capacity,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {state.data.notes ? ` · ${state.data.notes}` : ""}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-x-5">
          <Link className={linkClass} href="/mind">
            Add a note
          </Link>
          <Link className={linkClass} href="/review">
            Look back at the week
          </Link>
        </div>
      </Section>
    </div>
  );
}
