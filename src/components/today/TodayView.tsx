import Link from "next/link";
import { cn } from "cn";
import { CalendarDays } from "lucide-react";

import type { TodayView as TodayViewModel } from "@/contracts/today";
import { Badge } from "@/components/ui/badge";

import { BlockRow } from "./BlockRow";
import { OBSERVATION_CATEGORY_LABEL, TASK_KIND_LABEL } from "./labels";
import { ProvenanceLink } from "./ProvenanceLink";
import { EmptyLine, Section } from "./Section";

export function TodayHeader({ dateLabel, timezone }: { dateLabel: string; timezone: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">Today</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{dateLabel}</h1>
      <p className="text-xs text-muted-foreground">Times shown in {timezone}</p>
    </div>
  );
}

export function TodayView({ view }: { view: TodayViewModel }) {
  return (
    <div className="space-y-8">
      <TodayHeader dateLabel={view.dateLabel} timezone={view.timezone} />

      {view.isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
          <CalendarDays className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nothing planned yet.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your schedule, open tasks, and the things you tell LTS about your day will show up here.
          </p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-8">
            <Section
              title="Schedule"
              meta={view.blocks.length > 0 ? `${view.blocks.length} today` : undefined}
            >
              {view.blocks.length > 0 ? (
                <ol className="space-y-2">
                  {view.blocks.map((block) => (
                    <BlockRow key={block.id} block={block} showTiming />
                  ))}
                </ol>
              ) : (
                <EmptyLine>Nothing scheduled today.</EmptyLine>
              )}
            </Section>

            <Section title="You said today">
              {view.observations.length > 0 ? (
                <ul className="space-y-2">
                  {view.observations.map((o) => (
                    <li key={o.id} className="rounded-lg border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {OBSERVATION_CATEGORY_LABEL[o.category]}
                      </p>
                      <p className="mt-0.5">&ldquo;{o.valueText}&rdquo;</p>
                      <ProvenanceLink provenance={o.provenance} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>Nothing noted today.</EmptyLine>
              )}
            </Section>
          </div>

          <div className="space-y-8">
            <Section
              title="Open tasks"
              meta={view.openTasks.length > 0 ? String(view.openTasks.length) : undefined}
            >
              <p className="mb-3 text-sm">
                <Link className="text-primary underline-offset-4 hover:underline" href="/tasks">
                  Manage tasks
                </Link>
              </p>
              {view.openTasks.length > 0 ? (
                <ul className="divide-y rounded-lg border bg-card">
                  {view.openTasks.map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="leading-snug font-medium break-words">{task.title}</p>
                        <ProvenanceLink provenance={task.provenance} />
                        <p className="text-xs text-muted-foreground">
                          {TASK_KIND_LABEL[task.taskKind]}
                          {" · "}
                          {task.priority} priority
                        </p>
                      </div>
                      {task.dueLabel ? (
                        <Badge
                          variant={task.dueToday ? "default" : "outline"}
                          className={cn("mt-0.5", task.pastDue && "text-muted-foreground")}
                        >
                          {task.dueLabel}
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>No open tasks.</EmptyLine>
              )}
            </Section>

            <Section title="Next 7 days">
              {view.upcoming.length > 0 ? (
                <div className="space-y-4">
                  {view.upcoming.map((day) => (
                    <div key={day.date} className="space-y-2">
                      <h3 className="text-sm font-medium">{day.label}</h3>
                      <ol className="space-y-2">
                        {day.blocks.map((block) => (
                          <BlockRow key={block.id} block={block} showTiming={false} />
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyLine>Nothing scheduled in the next 7 days.</EmptyLine>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
