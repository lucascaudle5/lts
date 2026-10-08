import type { TodayModel } from "./model";

export function Greeting({
  model,
  dateLabel,
  timezone,
}: {
  model: TodayModel;
  dateLabel: string;
  timezone: string;
}) {
  return (
    <header className="space-y-2 pt-1">
      <p className="eyebrow text-muted-foreground">
        {dateLabel} <span aria-hidden>·</span> {timezone}
      </p>
      <h1 className="text-[2rem] leading-[2.375rem]">{model.greeting}</h1>
      {model.note ? (
        <p
          className={
            model.load === "heavy"
              ? "inline-block rounded-lg bg-quiet-soft px-3 py-2 text-[15px] leading-snug text-quiet"
              : "text-[15px] leading-snug text-ink-soft"
          }
        >
          {model.note}
        </p>
      ) : null}
    </header>
  );
}
