import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import type { ReactNode } from "react";

import type { WorkspaceData } from "@/contracts/life";
import type { TodayView } from "@/contracts/today";

import { BlockRow } from "./BlockRow";
import { FloorChecklist } from "./FloorChecklist";
import { Greeting } from "./Greeting";
import { buildTodayModel } from "./model";
import { Section } from "./Section";
import { TodayPanels } from "./TodayPanels";
import { UpNext } from "./UpNext";

type Act = (input: unknown) => Promise<{ ok: boolean; message: string }>;

/**
 * One hierarchy for the day: greeting, capture, what is next, the floor, then the rest.
 * `capture` is the hero card (a server form), passed in so this stays presentational.
 */
export function TodayBoard({
  view,
  data,
  act,
  capture,
  banner,
}: {
  view: TodayView;
  data: WorkspaceData;
  act: Act;
  capture: ReactNode;
  banner?: ReactNode;
}) {
  const model = buildTodayModel(view, data);
  const heavy = model.load === "heavy";
  const rest = (
    <div className="space-y-6">
      {model.laterToday.length > 0 ? (
        <Section title="Later today" meta={String(model.laterToday.length)} room="plan">
          <ol className="space-y-2">
            {model.laterToday.map((block) => (
              <BlockRow key={block.id} block={block} />
            ))}
          </ol>
        </Section>
      ) : null}
      <TodayPanels view={view} data={data} />
    </div>
  );

  return (
    <div
      data-room="nova"
      data-load={model.load}
      data-daypart={model.daypart}
      className="today-sky space-y-6"
    >
      <Greeting model={model} dateLabel={view.dateLabel} timezone={view.timezone} />
      {banner}
      {capture}

      {model.load === "empty" ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong/60 px-6 py-10 text-center">
          <CalendarHeart className="size-8 text-gold-text" aria-hidden strokeWidth={1.5} />
          <p className="font-heading text-lg font-semibold">A clear day.</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Tell me what&apos;s on it above, or leave it open. Your schedule, tasks and floor will
            gather here.
          </p>
        </div>
      ) : (
        <>
          <UpNext model={model} />
          {model.earlier.length > 0 ? (
            <details className="group rounded-xl border bg-surface-2 px-4 py-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
                <span>Earlier today</span>
                <span className="eyebrow text-muted-foreground">{model.earlier.length}</span>
              </summary>
              <ol className="space-y-2 pt-1 pb-2">
                {model.earlier.map((block) => (
                  <BlockRow key={block.id} block={block} quiet />
                ))}
              </ol>
            </details>
          ) : null}
          <FloorChecklist
            date={data.today}
            floor={model.floor}
            routines={model.routines}
            act={act}
          />
          {model.load === "done" ? (
            <p className="rounded-xl border bg-card px-4 py-3 text-sm text-ink-soft">
              Nothing new is asking for you. Anything you add above will show up here.
            </p>
          ) : null}
          {heavy ? (
            <details className="rounded-2xl border bg-surface-2 px-4 py-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium">
                Show everything else
              </summary>
              <div className="pt-3 pb-3">{rest}</div>
            </details>
          ) : (
            rest
          )}
        </>
      )}

      <p className="pt-2 text-sm">
        <Link
          href="/history"
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Recent changes · inspect or undo
        </Link>
      </p>
    </div>
  );
}
