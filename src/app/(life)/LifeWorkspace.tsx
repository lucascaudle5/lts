"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  addDays,
  addMonths,
  format,
  parseISO,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import type {
  LifeRecord,
  LifeRow,
  LifeType,
  RecordOf,
  WorkspaceData,
  WorkspaceTask,
  ScheduleRow,
} from "@/contracts/life";
import type { TaskDetails } from "@/contracts/commands";

type Act = (input: unknown) => Promise<{ ok: boolean; message: string }>;
type Field = {
  key: string;
  label: string;
  kind?:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "time"
    | "boolean"
    | "days"
    | "steps"
    | "select"
    | "foods";
  reference?: LifeType;
  options?: string[];
  required?: boolean;
};
const f = (
  key: string,
  label: string,
  kind: Field["kind"] = "text",
  required = false,
  options?: string[],
): Field => ({ key, label, kind, required, options });
const fields: Record<LifeType, Field[]> = {
  habit: [
    f("tier", "Role", "select", true, ["floor", "optional"]),
    f("anchor", "Anchor / cue"),
    f("unit", "Track", "select", true, ["check", "count", "minutes"]),
    f("target", "Minimum target", "number", true),
    f("days", "Scheduled days", "days"),
  ],
  habit_log: [
    { ...f("habitId", "Habit", "select", true), reference: "habit" },
    f("date", "Date", "date", true),
    f("value", "Amount completed", "number", true),
    f("outcome", "Outcome", "select", true, ["done", "partial", "skipped"]),
  ],
  routine: [
    f("anchor", "Anchor / cue"),
    f("minutes", "Full version minutes", "number", true),
    f("days", "Scheduled days", "days"),
    f("full", "Full steps (one per line)", "steps", true),
    f("short", "Short steps (one per line)", "steps", true),
    f("minimum", "Minimum steps (one per line)", "steps", true),
  ],
  routine_run: [
    { ...f("routineId", "Routine", "select", true), reference: "routine" },
    f("date", "Date", "date", true),
    f("variant", "Variant", "select", true, ["full", "short", "minimum"]),
    f("outcome", "Outcome", "select", true, ["done", "partial", "skipped"]),
    f("completedSteps", "Completed steps (one per line, matching the selected variant)", "steps"),
  ],
  workout_plan: [
    f("position", "Position in split", "number", true),
    f("minutes", "Planned minutes", "number", true),
    f("exercises", "Exercises / sets / reps", "textarea", true),
    f("substitutions", "Substitutions / minimum version", "textarea"),
  ],
  exercise: [
    f("equipment", "Equipment"),
    f("instructions", "Instructions / technique notes", "textarea"),
    f("substitutions", "Substitutions", "textarea"),
  ],
  workout: [
    { ...f("planId", "Workout plan (optional)", "select"), reference: "workout_plan" },
    f("date", "Date", "date", true),
    f("exercises", "Exercises, sets, reps, load and RPE (your log)", "textarea", true),
    f("minutes", "Minutes", "number"),
    f("effort", "Reported effort", "select", true, ["not_recorded", "easy", "moderate", "hard"]),
    f("outcome", "Outcome", "select", true, ["done", "partial", "skipped"]),
  ],
  body_log: [
    f("date", "Date", "date", true),
    f("weight", "Weight", "number", true),
    f("unit", "Unit", "select", true, ["lb", "kg"]),
  ],
  food: [
    f("serving", "Serving description", "text", true),
    f("calories", "Calories per serving", "number"),
    f("protein", "Protein (g)", "number"),
    f("carbs", "Carbs (g)", "number"),
    f("fat", "Fat (g)", "number"),
    f("favorite", "Favorite", "boolean"),
  ],
  meal_template: [f("foods", "Foods and portions", "foods", true)],
  meal: [
    f("date", "Date", "date", true),
    f("time", "Time", "time"),
    f("window", "Meal", "select", true, ["breakfast", "lunch", "dinner", "snack"]),
    f("calories", "Calories (if known)", "number"),
    f("protein", "Protein (g)", "number"),
    f("carbs", "Carbs (g)", "number"),
    f("fat", "Fat (g)", "number"),
  ],
  nutrition_targets: [
    f("calories", "Your calorie target", "number"),
    f("protein", "Your protein target (g)", "number"),
    f("carbs", "Your carb target (g)", "number"),
    f("fat", "Your fat target (g)", "number"),
  ],
  state: [
    f("date", "Date", "date", true),
    f("sleepHours", "Reported sleep hours", "number"),
    f("sleepStart", "Sleep start", "time"),
    f("sleepEnd", "Wake time", "time"),
    f("energy", "Energy, in your words"),
    f("mood", "Mood, in your words"),
    f("stress", "Stress, in your words"),
    f("capacity", "What feels manageable today?"),
  ],
  project: [
    f("status", "Status", "select", true, ["active", "parked", "done"]),
    f("nextAction", "Next action"),
    f("dueOn", "Due date", "date"),
    f("frontier", "Active frontier (up to three)", "boolean"),
  ],
  money: [
    f("date", "Date / bill due", "date", true),
    f("direction", "Type", "select", true, ["expense", "income", "bill"]),
    f("amount", "Amount", "number", true),
    f("currency", "Currency code", "text", true),
    f("category", "Category"),
    f("paid", "Bill paid", "boolean"),
    f("recurrence", "When paid, create the next bill", "select", true, [
      "none",
      "weekly",
      "monthly",
    ]),
  ],
  review: [
    f("from", "From", "date", true),
    f("to", "Through", "date", true),
    f("decisions", "Decisions / next steps", "textarea"),
  ],
};
const names: Record<LifeType, string> = {
  habit: "Habit",
  habit_log: "Habit check-in",
  routine: "Routine",
  routine_run: "Routine run",
  workout_plan: "Workout plan",
  exercise: "Exercise library",
  workout: "Workout log",
  body_log: "Bodyweight",
  food: "Food",
  meal_template: "Meal template",
  meal: "Meal log",
  nutrition_targets: "Nutrition targets",
  state: "Sleep and state note",
  project: "Project",
  money: "Money entry",
  review: "Review",
};
const rooms: Record<string, { title: string; description: string; types: LifeType[] }> = {
  habits: {
    title: "Habits",
    description: "Protect the floor first. Log what happened, including an intentional skip.",
    types: ["habit", "habit_log"],
  },
  routines: {
    title: "Routines",
    description: "Full, short, and minimum versions all count. Choose what fits today.",
    types: ["routine", "routine_run"],
  },
  fitness: {
    title: "Fitness",
    description: "Plan your split, keep exercise notes, and log sessions and recovery.",
    types: ["workout_plan", "workout", "exercise", "body_log"],
  },
  diet: {
    title: "Food & meals",
    description: "Save foods and repeated meals. Targets are yours; unknown values stay unknown.",
    types: ["meal", "food", "meal_template", "nutrition_targets"],
  },
  mind: {
    title: "Sleep & state",
    description: "Your reports in your own words. No invented scores or capacity labels.",
    types: ["state"],
  },
  projects: {
    title: "Projects",
    description: "Keep a next action visible and choose up to three active frontiers.",
    types: ["project"],
  },
  money: {
    title: "Money",
    description: "Track bills and practical income and expense notes.",
    types: ["money"],
  },
  review: {
    title: "Review",
    description: "Look at evidence, choose a recovery step, and keep your decisions inspectable.",
    types: ["review"],
  },
};
const inputClass = "min-h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50";
const primaryClass = `${buttonClass} border-primary bg-primary text-primary-foreground hover:bg-primary/90`;
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Draft = { id?: string; data: LifeRecord; updatedAt?: string };
const emptyDetails: TaskDetails = {
  estimateMinutes: 0,
  nextAction: "",
  blocker: "",
  projectId: null,
  subtasks: [],
  sessions: [],
};

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{text}</span>
      {children}
    </label>
  );
}
function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Empty({
  text = "Nothing here yet. Add your first entry when it is useful.",
}: {
  text?: string;
}) {
  return (
    <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{text}</p>
  );
}
function human(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase());
}
function defaults(type: LifeType, date: string): LifeRecord {
  const base = { type, title: "", notes: "", date };
  const values: Record<string, unknown> = {
    tier: "floor",
    unit: "check",
    target: 1,
    days: [0, 1, 2, 3, 4, 5, 6],
    anchor: "",
    full: [],
    short: [],
    minimum: [],
    minutes: type === "routine" ? 15 : 45,
    position: 1,
    exercises: "",
    substitutions: "",
    outcome: "done",
    effort: "not_recorded",
    planId: null,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    serving: "1 serving",
    favorite: false,
    foods: [],
    time: null,
    window: "snack",
    sleepHours: null,
    sleepStart: null,
    sleepEnd: null,
    energy: "",
    mood: "",
    stress: "",
    capacity: "",
    status: "active",
    nextAction: "",
    dueOn: null,
    frontier: false,
    amount: 0,
    currency: "USD",
    direction: "expense",
    category: "",
    paid: false,
    from: date,
    to: date,
    decisions: "",
    citedIds: [],
    weight: 0,
  };
  return { ...values, ...base, ...(type === "body_log" ? { unit: "lb" } : {}) } as LifeRecord;
}
function items<T extends LifeType>(data: WorkspaceData, type: T) {
  return data.records.filter((r) => !r.archivedAt && r.data.type === type) as Array<
    LifeRow & { data: RecordOf<T> }
  >;
}

export function LifeWorkspace({
  room,
  data,
  act,
}: {
  room: string;
  data: WorkspaceData;
  act: Act;
}) {
  const router = useRouter();
  const [date, setDate] = useState(data.today);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<LifeType | null>(null);
  function mutate(input: unknown, done?: () => void) {
    if (
      input &&
      typeof input === "object" &&
      "kind" in input &&
      input.kind === "task.update" &&
      "payload" in input &&
      input.payload &&
      typeof input.payload === "object"
    ) {
      const payload = input.payload;
      const taskId = "taskId" in payload ? payload.taskId : null;
      const task = data.tasks.find((task) => task.id === taskId);
      input = {
        ...input,
        payload: { ...payload, ...(task?.updatedAt ? { expectedUpdatedAt: task.updatedAt } : {}) },
      };
    }
    startTransition(async () => {
      const result = await act(input);
      setMessage(result);
      if (result.ok) {
        done?.();
        router.refresh();
      }
    });
  }
  const edit = (row: LifeRow) => setDraft({ id: row.id, data: row.data, updatedAt: row.updatedAt });
  const create = (type: LifeType, overrides: Partial<LifeRecord> = {}) =>
    setDraft({ data: { ...defaults(type, date), ...overrides } as LifeRecord });
  const archive = (row: LifeRow) => {
    if (window.confirm(`Archive “${row.data.title}”? You can restore it later.`))
      mutate({ op: "record.archive", id: row.id, archive: true });
  };
  const recordSave = (record: LifeRecord, id?: string) =>
    mutate({ op: "record.save", ...(id ? { id } : {}), record });
  const content = rooms[room];
  const title = content?.title ?? human(room);
  const activeType = tab && content?.types.includes(tab) ? tab : content?.types[0];
  const rows = activeType
    ? items(data, activeType).filter((r) =>
        `${r.data.title} ${r.data.notes}`.toLowerCase().includes(filter.toLowerCase()),
      )
    : [];
  const logHabit = (habit: LifeRow & { data: RecordOf<"habit"> }, outcome: "done" | "skipped") =>
    create("habit_log", {
      title: habit.data.title,
      habitId: habit.id,
      date,
      value: outcome === "skipped" ? 0 : habit.data.target,
      outcome,
    });
  const logPlan = (plan: LifeRow & { data: RecordOf<"workout_plan"> }) =>
    create("workout", {
      title: plan.data.title,
      planId: plan.id,
      date,
      exercises: plan.data.exercises,
      minutes: plan.data.minutes,
    });
  function mealFromFood(food: LifeRow & { data: RecordOf<"food"> }) {
    create("meal", {
      title: food.data.title,
      date,
      calories: food.data.calories,
      protein: food.data.protein,
      carbs: food.data.carbs,
      fat: food.data.fat,
      notes: food.data.serving,
    });
  }
  function mealFromTemplate(template: LifeRow & { data: RecordOf<"meal_template"> }) {
    const foods = items(data, "food");
    const nutrition: Record<string, number | null> = {};
    for (const key of ["calories", "protein", "carbs", "fat"] as const) {
      let sum = 0;
      let known = true;
      for (const entry of template.data.foods) {
        const food = foods.find((f) => f.id === entry.foodId);
        if (!food || food.data[key] === null) known = false;
        else sum += food.data[key]! * entry.servings;
      }
      nutrition[key] = known ? sum : null;
    }
    create("meal", { title: template.data.title, ...nutrition, date, notes: template.data.notes });
  }
  const extras = (
    <>
      {room === "habits" && (
        <Panel title={`Your floor · ${date}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {items(data, "habit")
              .filter((r) => r.data.days.includes(parseISO(date).getDay()))
              .sort(
                (a, b) => Number(a.data.tier === "optional") - Number(b.data.tier === "optional"),
              )
              .map((habit) => {
                const log = items(data, "habit_log").find(
                  (l) => l.data.habitId === habit.id && l.data.date === date,
                );
                const week = items(data, "habit_log").filter(
                  (l) =>
                    l.data.habitId === habit.id &&
                    l.data.date >= format(addDays(parseISO(date), -6), "yyyy-MM-dd") &&
                    l.data.date <= date,
                );
                return (
                  <div key={habit.id} className="space-y-3 rounded-xl border p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {human(habit.data.tier)} · {habit.data.anchor || "No anchor"}
                      </p>
                      <h3 className="font-medium">{habit.data.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Minimum: {habit.data.target}{" "}
                        {habit.data.unit === "check" ? "check-in" : habit.data.unit}.{" "}
                        {week.filter((l) => l.data.outcome === "done").length} completed in the last
                        7 days.
                      </p>
                    </div>
                    {log ? (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm">
                          {human(log.data.outcome)} · {log.data.value} {habit.data.unit}
                        </p>
                        <button
                          className={buttonClass}
                          disabled={pending}
                          onClick={() => edit(log)}
                        >
                          Edit log
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={primaryClass}
                          disabled={pending}
                          onClick={() => logHabit(habit, "done")}
                        >
                          Log minimum
                        </button>
                        <button
                          className={buttonClass}
                          disabled={pending}
                          onClick={() => logHabit(habit, "skipped")}
                        >
                          Intentional skip
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          {!items(data, "habit").length && (
            <Empty text="Add a floor habit below. The minimum is enough." />
          )}
        </Panel>
      )}
      {room === "routines" && (
        <Panel title="Choose the version that fits">
          <div className="grid gap-4 md:grid-cols-2">
            {items(data, "routine")
              .filter((r) => r.data.days.includes(parseISO(date).getDay()))
              .map((routine) => (
                <RoutineRunner
                  key={routine.id}
                  routine={routine}
                  date={date}
                  logs={items(data, "routine_run")}
                  save={recordSave}
                  pending={pending}
                />
              ))}
          </div>
          {!items(data, "routine").length && (
            <Empty text="Create a routine with full, short, and minimum steps." />
          )}
        </Panel>
      )}
      {room === "fitness" && (
        <FitnessOverview data={data} date={date} logPlan={logPlan} create={create} />
      )}
      {room === "diet" && (
        <DietOverview
          data={data}
          date={date}
          create={create}
          foodMeal={mealFromFood}
          templateMeal={mealFromTemplate}
        />
      )}
      {room === "mind" && (
        <Panel title="Reported today">
          {items(data, "state")
            .filter((r) => r.data.date === date)
            .map((r) => (
              <p className="text-sm" key={r.id}>
                {r.data.sleepHours !== null ? `${r.data.sleepHours} hours sleep · ` : ""}
                {[r.data.energy, r.data.mood, r.data.stress, r.data.capacity]
                  .filter(Boolean)
                  .join(" · ")}
                {r.data.notes ? ` · ${r.data.notes}` : ""}
              </p>
            ))}
          {data.observations
            .filter((o) => !o.archivedAt && o.occurredOn === date)
            .map((o) => (
              <ObservationEditor key={o.id} observation={o} mutate={mutate} pending={pending} />
            ))}
          <p className="text-xs text-muted-foreground">
            These are your reports. Suggestions in Review cite records and remain separate.
          </p>
        </Panel>
      )}
      {room === "projects" && (
        <Panel title="Active frontier">
          <div className="grid gap-3 sm:grid-cols-3">
            {items(data, "project")
              .filter((r) => r.data.frontier && r.data.status === "active")
              .map((r) => (
                <div key={r.id} className="rounded-xl border p-4">
                  <h3 className="font-medium">{r.data.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {r.data.nextAction || "Choose a next action"}
                  </p>
                  <p className="mt-2 text-xs">
                    {
                      data.tasks.filter(
                        (t) => !t.archivedAt && t.details.projectId === r.id && t.status === "open",
                      ).length
                    }{" "}
                    open tasks
                  </p>
                  <Link className="mt-2 inline-block text-sm underline" href="/tasks">
                    Manage linked tasks
                  </Link>
                </div>
              ))}
          </div>
        </Panel>
      )}
      {room === "money" && (
        <MoneyOverview data={data} date={date} mutate={mutate} pending={pending} />
      )}
      {room === "review" && (
        <ReviewOverview data={data} date={date} create={create} mutate={mutate} />
      )}
    </>
  );
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-1">
          <p className="text-xs font-medium tracking-[.2em] text-muted-foreground uppercase">
            NOVA · Life Tracker Suite
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {content?.description ??
              {
                schedule: "Make room for commitments, meals, focus, and recovery.",
                tasks: "Assignments and tasks with a clear next action.",
                history: "Inspect your changes and undo the latest edit.",
                archive: "Find and restore parked records.",
                inbox: "Your original notes and proposals, always inspectable.",
                sandbox: "Try a fictional day in an isolated workspace.",
              }[room]}
          </p>
        </div>
        <Label text="Viewing date">
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </Label>
      </header>
      {message && (
        <div
          role={message.ok ? "status" : "alert"}
          className={`sticky top-28 z-50 flex items-center justify-between gap-4 rounded-xl border p-3 text-sm shadow-sm ${message.ok ? "bg-card" : "border-destructive bg-background text-destructive"}`}
        >
          {message.message}
          <button aria-label="Dismiss message" onClick={() => setMessage(null)}>
            ×
          </button>
        </div>
      )}
      {room === "schedule" && (
        <ScheduleBoard
          data={data}
          date={date}
          setDate={setDate}
          mutate={mutate}
          pending={pending}
        />
      )}
      {room === "tasks" && <TasksBoard data={data} date={date} mutate={mutate} pending={pending} />}
      {(room === "history" || room === "archive") && (
        <HistoryBoard data={data} room={room} mutate={mutate} pending={pending} />
      )}
      {room === "inbox" && (
        <Panel title="Capture inbox">
          {data.captures.length ? (
            <div className="space-y-3">
              {data.captures.map((c) => (
                <Link
                  href={`/captures/${c.id}`}
                  key={c.id}
                  className="block rounded-xl border p-4 hover:bg-muted"
                >
                  <p className="text-sm whitespace-pre-wrap">{c.text}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {c.date} ·{" "}
                    {c.pending
                      ? `${c.pending} pending proposals`
                      : "Reviewed / no pending proposals"}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty text="Your notes will appear here after you capture them on Today." />
          )}
        </Panel>
      )}
      {room === "sandbox" && <Sandbox data={data} />}
      {content && (
        <>
          {extras}
          <Panel
            title="Manage entries"
            action={
              <button
                className={primaryClass}
                disabled={pending}
                onClick={() => activeType && create(activeType)}
              >
                Add {activeType ? names[activeType].toLowerCase() : "entry"}
              </button>
            }
          >
            <div className="flex flex-wrap gap-2">
              {content.types.map((type) => (
                <button
                  key={type}
                  className={`${buttonClass} ${activeType === type ? "bg-muted" : ""}`}
                  onClick={() => {
                    setTab(type);
                    setFilter("");
                  }}
                >
                  {names[type]}
                </button>
              ))}
            </div>
            <input
              aria-label="Search entries"
              placeholder="Search title or notes…"
              className={inputClass}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {rows.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {rows.map((row) => (
                  <RecordCard
                    key={row.id}
                    row={row}
                    edit={edit}
                    archive={archive}
                    pending={pending}
                  />
                ))}
              </div>
            ) : (
              <Empty />
            )}
          </Panel>
        </>
      )}
      {draft && (
        <RecordEditor
          key={`${draft.id ?? "new"}-${draft.data.type}-${draft.data.title}`}
          draft={draft}
          data={data}
          pending={pending}
          close={() => setDraft(null)}
          save={(record) =>
            mutate(
              {
                op: "record.save",
                ...(draft.id ? { id: draft.id, expectedUpdatedAt: draft.updatedAt } : {}),
                record,
              },
              () => setDraft(null),
            )
          }
        />
      )}
      <p className="text-xs text-muted-foreground">
        Dates and times use {data.timezone}.{" "}
        <Link href="/settings" className="underline">
          Settings
        </Link>{" "}
        ·{" "}
        <Link href="/history" className="underline">
          History & export
        </Link>
      </p>
    </div>
  );
}

function RecordCard({
  row,
  edit,
  archive,
  pending,
}: {
  row: LifeRow;
  edit: (row: LifeRow) => void;
  archive: (row: LifeRow) => void;
  pending: boolean;
}) {
  const data = row.data;
  return (
    <article className="space-y-3 rounded-xl border p-4">
      <div>
        <p className="text-xs text-muted-foreground">
          {names[data.type]}
          {"date" in data ? ` · ${data.date}` : ""}
        </p>
        <h3 className="mt-1 font-medium">{data.title}</h3>
      </div>
      <dl className="grid gap-1 text-sm">
        {fields[data.type]
          .filter((field) => !["days", "foods"].includes(field.kind ?? ""))
          .map((field) => {
            const value = (data as unknown as Record<string, unknown>)[field.key];
            if (value === null || value === "" || value === false || value === undefined)
              return null;
            return (
              <div key={field.key}>
                <dt className="inline text-muted-foreground">{field.label}: </dt>
                <dd className="inline whitespace-pre-wrap">
                  {Array.isArray(value)
                    ? value.join(" → ")
                    : value === true
                      ? "Yes"
                      : String(value)}
                </dd>
              </div>
            );
          })}
      </dl>
      {data.notes && (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{data.notes}</p>
      )}
      <div className="flex gap-2">
        <button disabled={pending} className={buttonClass} onClick={() => edit(row)}>
          Edit
        </button>
        <button disabled={pending} className={buttonClass} onClick={() => archive(row)}>
          Archive
        </button>
      </div>
    </article>
  );
}

function RecordEditor({
  draft,
  data,
  pending,
  close,
  save,
}: {
  draft: Draft;
  data: WorkspaceData;
  pending: boolean;
  close: () => void;
  save: (record: LifeRecord) => void;
}) {
  const record = draft.data;
  const initial = record as unknown as Record<string, unknown>;
  const [foodCount, setFoodCount] = useState(
    Math.max(3, Array.isArray(initial.foods) ? initial.foods.length : 0),
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const result: Record<string, unknown> = {
      ...initial,
      title: fd.get("title"),
      notes: fd.get("notes") ?? "",
      collection: fd.get("collection") ?? "",
    };
    for (const field of fields[record.type]) {
      const value = String(fd.get(field.key) ?? "");
      if (field.kind === "number") result[field.key] = value === "" ? null : Number(value);
      else if (field.kind === "boolean") result[field.key] = fd.has(field.key);
      else if (field.kind === "days") result[field.key] = fd.getAll(field.key).map(Number);
      else if (field.kind === "steps")
        result[field.key] = value
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      else if (field.kind === "foods")
        result[field.key] = Array.from({ length: foodCount }, (_, i) => ({
          foodId: String(fd.get(`food${i}`) ?? ""),
          servings: Number(fd.get(`servings${i}`) ?? 1),
        })).filter((f) => f.foodId);
      else
        result[field.key] =
          value ||
          ((["date", "time"].includes(field.kind ?? "") || field.reference) && !field.required
            ? null
            : "");
    }
    save(result as LifeRecord);
  }
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-3 pt-10 sm:p-8"
      onClick={(e) => e.target === e.currentTarget && !pending && close()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-title"
        className="w-full max-w-2xl rounded-2xl border bg-background p-5 shadow-xl"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="entry-title" className="text-xl font-semibold">
            {draft.id ? "Edit" : "Add"} {names[record.type].toLowerCase()}
          </h2>
          <button disabled={pending} className={buttonClass} onClick={close}>
            Close
          </button>
        </div>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label text="Title">
              <input
                autoFocus
                required
                name="title"
                maxLength={120}
                defaultValue={record.title}
                className={inputClass}
              />
            </Label>
          </div>
          {fields[record.type].map((field) => (
            <div
              key={field.key}
              className={
                ["steps", "textarea", "days", "foods"].includes(field.kind ?? "")
                  ? "sm:col-span-2"
                  : ""
              }
            >
              <Label text={field.label}>
                {field.kind === "boolean" ? (
                  <input
                    type="checkbox"
                    name={field.key}
                    defaultChecked={Boolean(initial[field.key])}
                    className="size-5 accent-primary"
                  />
                ) : field.kind === "days" ? (
                  <span className="flex flex-wrap gap-3">
                    {weekdays.map((day, i) => (
                      <span key={day} className="flex items-center gap-1">
                        <input
                          aria-label={day}
                          type="checkbox"
                          name={field.key}
                          value={i}
                          defaultChecked={(initial[field.key] as number[]).includes(i)}
                        />
                        {day}
                      </span>
                    ))}
                  </span>
                ) : field.kind === "select" ? (
                  <select
                    name={field.key}
                    className={inputClass}
                    required={field.required}
                    defaultValue={String(initial[field.key] ?? field.options?.[0] ?? "")}
                  >
                    {field.reference && (
                      <>
                        <option value="">Choose {names[field.reference].toLowerCase()}</option>
                        {items(data, field.reference).map((row) => (
                          <option value={row.id} key={row.id}>
                            {row.data.title}
                          </option>
                        ))}
                      </>
                    )}
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {human(option)}
                      </option>
                    ))}
                  </select>
                ) : field.kind === "foods" ? (
                  <span className="space-y-2">
                    {Array.from({ length: foodCount }, (_, i) => {
                      const existing = (
                        initial.foods as Array<{ foodId: string; servings: number }>
                      )[i];
                      return (
                        <span className="flex gap-2" key={i}>
                          <select
                            aria-label={`Food ${i + 1}`}
                            name={`food${i}`}
                            className={inputClass}
                            defaultValue={existing?.foodId ?? ""}
                          >
                            <option value="">Choose food (optional)</option>
                            {items(data, "food").map((food) => (
                              <option key={food.id} value={food.id}>
                                {food.data.title} · {food.data.serving}
                              </option>
                            ))}
                          </select>
                          <input
                            aria-label={`Servings ${i + 1}`}
                            name={`servings${i}`}
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            className={`${inputClass} max-w-24`}
                            defaultValue={existing?.servings ?? 1}
                          />
                        </span>
                      );
                    })}
                    {foodCount < 30 && (
                      <button
                        className={buttonClass}
                        type="button"
                        onClick={() => setFoodCount(foodCount + 1)}
                      >
                        Add another food
                      </button>
                    )}
                  </span>
                ) : field.kind === "steps" || field.kind === "textarea" ? (
                  <textarea
                    name={field.key}
                    className={inputClass}
                    required={field.required}
                    rows={4}
                    maxLength={4000}
                    defaultValue={
                      Array.isArray(initial[field.key])
                        ? (initial[field.key] as string[]).join("\n")
                        : String(initial[field.key] ?? "")
                    }
                  />
                ) : (
                  <input
                    name={field.key}
                    className={inputClass}
                    required={field.required}
                    type={field.kind ?? "text"}
                    min={field.kind === "number" ? 0 : undefined}
                    step={field.kind === "number" ? "any" : undefined}
                    maxLength={field.kind === "text" ? 300 : undefined}
                    defaultValue={String(initial[field.key] ?? "")}
                  />
                )}
              </Label>
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label text="Collection (optional)">
              <input
                name="collection"
                maxLength={120}
                className={inputClass}
                defaultValue={record.collection ?? ""}
              />
            </Label>
          </div>
          <div className="sm:col-span-2">
            <Label text="Notes">
              <textarea
                name="notes"
                maxLength={4000}
                rows={3}
                className={inputClass}
                defaultValue={record.notes}
              />
            </Label>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" disabled={pending} className={buttonClass} onClick={close}>
              Cancel
            </button>
            <button disabled={pending} className={primaryClass}>
              {pending ? "Saving…" : "Save entry"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RoutineRunner({
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
  const [variant, setVariant] = useState<"full" | "short" | "minimum">("full");
  const [completed, setCompleted] = useState<string[]>([]);
  const steps = routine.data[variant];
  const log = logs.find((l) => l.data.routineId === routine.id && l.data.date === date);
  function submit(outcome: "done" | "partial" | "skipped") {
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
  }
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <h3 className="font-medium">{routine.data.title}</h3>
      <p className="text-xs text-muted-foreground">
        {routine.data.anchor || "No anchor"}
        {log
          ? ` · Logged ${log.data.variant}: ${log.data.outcome}`
          : " · Not logged yet; a minimum version is available"}
      </p>
      <select
        aria-label={`${routine.data.title} variant`}
        className={inputClass}
        value={variant}
        onChange={(e) => {
          setVariant(e.target.value as typeof variant);
          setCompleted([]);
        }}
      >
        {["full", "short", "minimum"].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <label className="flex items-start gap-2 text-sm" key={`${step}-${i}`}>
            <input
              type="checkbox"
              checked={completed.includes(step)}
              onChange={(e) =>
                setCompleted(
                  e.target.checked ? [...completed, step] : completed.filter((s) => s !== step),
                )
              }
            />
            {step}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={primaryClass} disabled={pending} onClick={() => submit("done")}>
          Complete {variant}
        </button>
        <button
          className={buttonClass}
          disabled={pending || !completed.length}
          onClick={() => submit("partial")}
        >
          Save partial
        </button>
        <button className={buttonClass} disabled={pending} onClick={() => submit("skipped")}>
          Skip intentionally
        </button>
      </div>
    </div>
  );
}

function FitnessOverview({
  data,
  date,
  logPlan,
  create,
}: {
  data: WorkspaceData;
  date: string;
  logPlan: (plan: LifeRow & { data: RecordOf<"workout_plan"> }) => void;
  create: (type: LifeType, values?: Partial<LifeRecord>) => void;
}) {
  const plans = items(data, "workout_plan").sort((a, b) => a.data.position - b.data.position);
  const logs = items(data, "workout").sort(
    (a, b) => b.data.date.localeCompare(a.data.date) || b.createdAt.localeCompare(a.createdAt),
  );
  const previous = logs.find((l) => l.data.outcome === "done" && l.data.planId);
  const next = plans.length
    ? plans[(plans.findIndex((p) => p.id === previous?.data.planId) + 1) % plans.length]
    : null;
  return (
    <Panel title="Next session">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          {next ? (
            <>
              <h3 className="font-medium">
                {next.data.title} · {next.data.minutes} minutes
              </h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {next.data.exercises}
              </p>
              {next.data.substitutions && (
                <p className="text-sm">Smaller option / substitutions: {next.data.substitutions}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button className={primaryClass} onClick={() => logPlan(next)}>
                  Log this session
                </button>
                <Link href="/schedule" className={buttonClass}>
                  Put it on the schedule
                </Link>
              </div>
            </>
          ) : (
            <Empty text="Add a workout plan below or log a session directly." />
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm">
            {
              logs.filter(
                (l) =>
                  l.data.date >= format(addDays(parseISO(date), -6), "yyyy-MM-dd") &&
                  l.data.date <= date &&
                  l.data.outcome === "done",
              ).length
            }{" "}
            completed sessions in the last 7 days.
          </p>
          {logs[0] && (
            <p className="text-sm text-muted-foreground">
              Last log: {logs[0].data.title} · {logs[0].data.date} · {logs[0].data.outcome}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            A missed session can be moved or logged as partial. Your split advances after a
            completed session.
          </p>
          <button className={buttonClass} onClick={() => create("workout", { date })}>
            Log an unplanned workout
          </button>
        </div>
      </div>
    </Panel>
  );
}

function DietOverview({
  data,
  date,
  create,
  foodMeal,
  templateMeal,
}: {
  data: WorkspaceData;
  date: string;
  create: (type: LifeType, values?: Partial<LifeRecord>) => void;
  foodMeal: (food: LifeRow & { data: RecordOf<"food"> }) => void;
  templateMeal: (template: LifeRow & { data: RecordOf<"meal_template"> }) => void;
}) {
  const meals = items(data, "meal").filter((r) => r.data.date === date);
  const targets = items(data, "nutrition_targets")[0];
  return (
    <Panel
      title={`Meals · ${date}`}
      action={
        <button className={primaryClass} onClick={() => create("meal", { date })}>
          Log meal
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["calories", "protein", "carbs", "fat"] as const).map((key) => {
          const total = meals.reduce((sum, m) => sum + (m.data[key] ?? 0), 0);
          const unknown = meals.filter((m) => m.data[key] === null).length;
          return (
            <div key={key} className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">{human(key)}</p>
              <p className="mt-1 text-xl font-semibold">
                {Math.round(total * 10) / 10}
                {key === "calories" ? "" : "g"}
                {targets?.data[key] !== null && targets?.data[key] !== undefined
                  ? ` / ${targets.data[key]}`
                  : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {unknown
                  ? `${unknown} meal(s) without this value`
                  : meals.length
                    ? "From logged meals"
                    : "No meals logged"}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {items(data, "food")
          .filter((r) => r.data.favorite)
          .map((food) => (
            <button className={buttonClass} key={food.id} onClick={() => foodMeal(food)}>
              + {food.data.title}
            </button>
          ))}
        {items(data, "meal_template").map((template) => (
          <button className={buttonClass} key={template.id} onClick={() => templateMeal(template)}>
            + {template.data.title}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Use Schedule to protect meal or prep windows. Saving a repeated meal opens a log you can
        adjust before confirming.
      </p>
    </Panel>
  );
}

function MoneyOverview({
  data,
  date,
  mutate,
  pending,
}: {
  data: WorkspaceData;
  date: string;
  mutate: (input: unknown) => void;
  pending: boolean;
}) {
  const entries = items(data, "money");
  const month = date.slice(0, 7);
  const currencies = [...new Set(entries.map((r) => r.data.currency))];
  return (
    <Panel title="Bills and this month">
      <div className="flex flex-wrap gap-3">
        {currencies.map((currency) => {
          const rows = entries.filter(
            (r) => r.data.currency === currency && r.data.date.startsWith(month),
          );
          const income = rows
            .filter((r) => r.data.direction === "income")
            .reduce((s, r) => s + r.data.amount, 0);
          const expense = rows
            .filter(
              (r) => r.data.direction === "expense" || (r.data.direction === "bill" && r.data.paid),
            )
            .reduce((s, r) => s + r.data.amount, 0);
          return (
            <p className="rounded-xl border p-3 text-sm" key={currency}>
              {currency}: income {income.toFixed(2)} · recorded spend {expense.toFixed(2)}
            </p>
          );
        })}
      </div>
      <div className="space-y-2">
        {entries
          .filter((r) => r.data.direction === "bill" && !r.data.paid)
          .sort((a, b) => a.data.date.localeCompare(b.data.date))
          .map((row) => (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
              key={row.id}
            >
              <p className="text-sm">
                {row.data.title} · {row.data.currency} {row.data.amount.toFixed(2)} · due{" "}
                {row.data.date}
                {row.data.date < date ? " · Overdue" : ""}
              </p>
              <button
                className={buttonClass}
                disabled={pending}
                onClick={() => mutate({ op: "money.pay", id: row.id })}
              >
                Mark paid{row.data.recurrence !== "none" ? " & create next bill" : ""}
              </button>
            </div>
          ))}
      </div>
    </Panel>
  );
}

function ScheduleBoard({
  data,
  date,
  setDate,
  mutate,
  pending,
}: {
  data: WorkspaceData;
  date: string;
  setDate: (date: string) => void;
  mutate: (input: unknown, done?: () => void) => void;
  pending: boolean;
}) {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<unknown[] | null>(null);
  const [importError, setImportError] = useState("");
  const blocks = data.schedule.filter((b) => !b.archivedAt);
  const selected = parseISO(date);
  const start =
    view === "month"
      ? startOfMonth(selected)
      : view === "week"
        ? startOfWeek(selected, { weekStartsOn: 1 })
        : selected;
  const end = view === "month" ? endOfMonth(selected) : addDays(start, view === "week" ? 6 : 0);
  const dates = eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd"));
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    mutate(
      {
        op: "schedule.save",
        ...(editing ? { id: editing.id, expectedUpdatedAt: editing.updatedAt } : {}),
        block: {
          title: fd.get("title"),
          blockKind: fd.get("kind"),
          date: fd.get("date"),
          start: fd.get("start"),
          end: fd.get("end"),
          fixed: fd.has("fixed"),
        },
        allowOverlap: fd.has("overlap"),
        ...(fd.has("repeat") && !editing
          ? { repeat: { until: fd.get("until"), days: fd.getAll("day").map(Number) } }
          : {}),
      },
      () => setEditing(null),
    );
  }
  function parseImport() {
    try {
      const lines = importText.trim().split("\n").filter(Boolean);
      if (!lines.length || lines.length > 100) throw new Error("Use between 1 and 100 rows");
      const ops = lines.map((line, i) => {
        const [date, start, end, title, kind = "personal", fixed = "false"] = line
          .split("|")
          .map((s) => s.trim());
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !/^\d{2}:\d{2}$/.test(start) ||
          !/^\d{2}:\d{2}$/.test(end) ||
          !title ||
          !["work", "class", "exam", "fitness", "meal", "focus", "personal"].includes(kind)
        )
          throw new Error(`Check row ${i + 1}`);
        return {
          op: "schedule.save",
          block: { date, start, end, title, blockKind: kind, fixed: fixed === "true" },
        };
      });
      setPreview(ops);
      setImportError("");
    } catch (error) {
      setPreview(null);
      setImportError(error instanceof Error ? error.message : "Check the rows");
    }
  }
  return (
    <>
      <Panel
        title="Calendar"
        action={
          <div className="flex gap-1">
            {(["day", "week", "month"] as const).map((v) => (
              <button
                className={`${buttonClass} ${view === v ? "bg-muted" : ""}`}
                key={v}
                onClick={() => setView(v)}
              >
                {human(v)}
              </button>
            ))}
          </div>
        }
      >
        <div className="flex items-center justify-between gap-2">
          <button
            className={buttonClass}
            onClick={() =>
              setDate(
                format(
                  view === "month"
                    ? addMonths(selected, -1)
                    : addDays(selected, view === "week" ? -7 : -1),
                  "yyyy-MM-dd",
                ),
              )
            }
          >
            ← Previous
          </button>
          <button className={buttonClass} onClick={() => setDate(data.today)}>
            Today
          </button>
          <button
            className={buttonClass}
            onClick={() =>
              setDate(
                format(
                  view === "month"
                    ? addMonths(selected, 1)
                    : addDays(selected, view === "week" ? 7 : 1),
                  "yyyy-MM-dd",
                ),
              )
            }
          >
            Next →
          </button>
        </div>
        <div
          className={`grid gap-2 ${view === "day" ? "" : view === "month" ? "sm:grid-cols-4 lg:grid-cols-7" : "sm:grid-cols-2 lg:grid-cols-7"}`}
        >
          {dates.map((day) => {
            const rows = blocks
              .filter((b) => b.date === day)
              .sort((a, b) => a.start.localeCompare(b.start));
            return (
              <div
                key={day}
                className={`min-h-32 space-y-2 rounded-xl border p-3 ${day === data.today ? "border-primary/50 bg-primary/5" : ""}`}
              >
                <button
                  className="text-sm font-medium"
                  onClick={() => {
                    setDate(day);
                    setView("day");
                  }}
                >
                  {format(parseISO(day), "EEE d")}
                </button>
                {rows.map((block) => {
                  const conflict = rows.some(
                    (other) =>
                      other.id !== block.id && other.start < block.end && other.end > block.start,
                  );
                  return (
                    <button
                      className="block w-full rounded-lg border bg-background p-2 text-left text-xs hover:bg-muted"
                      key={block.id}
                      onClick={() => setEditing(block)}
                    >
                      <span className="block font-medium">{block.title}</span>
                      <span>
                        {block.start}–{block.end}
                      </span>
                      <span className="block text-muted-foreground">
                        {human(block.kind)}
                        {block.fixed ? " · Fixed" : ""}
                        {block.seriesId ? " · Repeats" : ""}
                        {conflict ? " · Overlap" : ""}
                      </span>
                    </button>
                  );
                })}
                {!rows.length && <p className="text-xs text-muted-foreground">Open space</p>}
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel
        title={editing ? `Edit ${editing.title}` : "Add a commitment"}
        action={
          editing && (
            <button className={buttonClass} onClick={() => setEditing(null)}>
              New block
            </button>
          )
        }
      >
        <form onSubmit={submit} key={editing?.id ?? date} className="grid gap-4 sm:grid-cols-3">
          <Label text="Title">
            <input
              required
              maxLength={120}
              name="title"
              className={inputClass}
              defaultValue={editing?.title ?? ""}
            />
          </Label>
          <Label text="Type">
            <select name="kind" className={inputClass} defaultValue={editing?.kind ?? "personal"}>
              {["work", "class", "exam", "fitness", "meal", "focus", "personal"].map((k) => (
                <option key={k} value={k}>
                  {human(k)}
                </option>
              ))}
            </select>
          </Label>
          <Label text="Date">
            <input
              required
              type="date"
              name="date"
              className={inputClass}
              defaultValue={editing?.date ?? date}
            />
          </Label>
          <Label text="Start">
            <input
              required
              type="time"
              name="start"
              className={inputClass}
              defaultValue={editing?.start ?? "09:00"}
            />
          </Label>
          <Label text="End">
            <input
              required
              type="time"
              name="end"
              className={inputClass}
              defaultValue={editing?.end ?? "10:00"}
            />
          </Label>
          <div className="space-y-2 text-sm">
            <label className="flex gap-2">
              <input type="checkbox" name="fixed" defaultChecked={editing?.fixed} />
              Fixed commitment
            </label>
            <label className="flex gap-2">
              <input type="checkbox" name="overlap" />
              Allow overlapping blocks
            </label>
          </div>
          {!editing && (
            <fieldset className="space-y-3 rounded-xl border p-3 sm:col-span-3">
              <legend className="px-1 text-sm">Optional repeating schedule</legend>
              <label className="flex gap-2 text-sm">
                <input type="checkbox" name="repeat" />
                Repeat on these days
              </label>
              <div className="flex flex-wrap gap-3">
                {weekdays.map((d, i) => (
                  <label className="flex gap-1 text-sm" key={d}>
                    <input
                      type="checkbox"
                      name="day"
                      value={i}
                      defaultChecked={i === selected.getDay()}
                    />
                    {d}
                  </label>
                ))}
              </div>
              <Label text="Repeat through (maximum one year, 200 occurrences)">
                <input
                  type="date"
                  name="until"
                  className={inputClass}
                  defaultValue={format(addDays(selected, 28), "yyyy-MM-dd")}
                />
              </Label>
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <button disabled={pending} className={primaryClass}>
              {pending ? "Saving…" : "Save block"}
            </button>
            {editing && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  className={buttonClass}
                  onClick={() =>
                    window.confirm("Archive this occurrence?") &&
                    mutate({ op: "schedule.archive", id: editing.id, archive: true }, () =>
                      setEditing(null),
                    )
                  }
                >
                  Archive occurrence
                </button>
                {editing.seriesId && (
                  <button
                    type="button"
                    disabled={pending}
                    className={buttonClass}
                    onClick={() =>
                      window.confirm("Archive every occurrence in this series?") &&
                      mutate(
                        { op: "schedule.archive", id: editing.id, archive: true, series: true },
                        () => setEditing(null),
                      )
                    }
                  >
                    Archive series
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </Panel>
      <details className="rounded-2xl border p-5">
        <summary className="cursor-pointer font-medium">Import fixed commitments</summary>
        <p className="mt-3 text-sm text-muted-foreground">
          One row per line: date | start | end | title | type | fixed. Preview before saving; the
          whole import succeeds or saves nothing.
        </p>
        <textarea
          aria-label="Schedule import"
          className={`${inputClass} mt-3 font-mono`}
          rows={5}
          placeholder="2026-10-12 | 09:00 | 10:00 | Class | class | true"
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value);
            setPreview(null);
          }}
        />
        <button className={`${buttonClass} mt-3`} onClick={parseImport}>
          Preview import
        </button>
        {importError && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {importError}
          </p>
        )}
        {preview && (
          <div className="mt-3 space-y-3">
            <pre className="max-h-64 overflow-auto rounded-xl bg-muted p-3 text-xs">
              {JSON.stringify(preview, null, 2)}
            </pre>
            <button
              disabled={pending}
              className={primaryClass}
              onClick={() =>
                mutate(preview, () => {
                  setPreview(null);
                  setImportText("");
                })
              }
            >
              Save {preview.length} commitments
            </button>
          </div>
        )}
      </details>
    </>
  );
}

function TasksBoard({
  data,
  date,
  mutate,
  pending,
}: {
  data: WorkspaceData;
  date: string;
  mutate: (input: unknown, done?: () => void) => void;
  pending: boolean;
}) {
  const [editing, setEditing] = useState<WorkspaceTask | "new" | null>(null);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("open");
  const tasks = data.tasks
    .filter(
      (t) =>
        !t.archivedAt &&
        t.status === status &&
        `${t.title} ${t.notes ?? ""}`.toLowerCase().includes(filter.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") ||
        { high: 0, medium: 1, low: 2 }[a.priority as "high"] -
          { high: 0, medium: 1, low: 2 }[b.priority as "high"],
    );
  return (
    <>
      <Panel
        title="Tasks & assignments"
        action={
          <button className={primaryClass} onClick={() => setEditing("new")}>
            Add task
          </button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {["open", "parked", "done"].map((s) => (
            <button
              className={`${buttonClass} ${s === status ? "bg-muted" : ""}`}
              key={s}
              onClick={() => setStatus(s)}
            >
              {human(s)} ({data.tasks.filter((t) => !t.archivedAt && t.status === s).length})
            </button>
          ))}
        </div>
        <input
          className={inputClass}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
        />
        <div className="space-y-3">
          {tasks.map((task) => {
            const details = task.details ?? emptyDetails;
            const spent = details.sessions.reduce((sum, s) => sum + s.minutes, 0);
            return (
              <article className="space-y-3 rounded-xl border p-4" key={task.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {human(task.kind)} · {task.priority} priority
                      {task.dueOn
                        ? ` · ${task.dueOn < date && task.status === "open" ? "Overdue · " : ""}Due ${task.dueOn}`
                        : ""}
                    </p>
                    <h3 className="mt-1 font-medium">{task.title}</h3>
                    {details.nextAction && (
                      <p className="mt-2 text-sm">Next: {details.nextAction}</p>
                    )}
                    {details.blocker && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Blocker: {details.blocker}
                      </p>
                    )}
                    {task.notes && (
                      <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                        {task.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={pending}
                      className={buttonClass}
                      onClick={() => setEditing(task)}
                    >
                      Edit
                    </button>
                    <button
                      disabled={pending}
                      className={primaryClass}
                      onClick={() =>
                        mutate({
                          kind: "task.update",
                          payload: {
                            taskId: task.id,
                            status: task.status === "done" ? "open" : "done",
                          },
                        })
                      }
                    >
                      {task.status === "done" ? "Reopen" : "Complete"}
                    </button>
                    <button
                      disabled={pending}
                      className={buttonClass}
                      onClick={() =>
                        mutate({
                          kind: "task.update",
                          payload: {
                            taskId: task.id,
                            status: task.status === "parked" ? "open" : "parked",
                          },
                        })
                      }
                    >
                      {task.status === "parked" ? "Resume" : "Park"}
                    </button>
                  </div>
                </div>
                {details.subtasks.length > 0 && (
                  <div className="grid gap-2">
                    {details.subtasks.map((subtask, i) => (
                      <label key={`${task.id}-${i}`} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          disabled={pending}
                          checked={subtask.done}
                          onChange={(e) =>
                            mutate({
                              kind: "task.update",
                              payload: {
                                taskId: task.id,
                                details: {
                                  ...details,
                                  subtasks: details.subtasks.map((s, index) =>
                                    index === i ? { ...s, done: e.target.checked } : s,
                                  ),
                                },
                              },
                            })
                          }
                        />
                        {subtask.title}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {spent} minutes logged
                    {details.estimateMinutes
                      ? ` · ${Math.max(details.estimateMinutes - spent, 0)} estimated remaining`
                      : ""}
                  </span>
                  {details.subtasks.length > 0 && (
                    <span>
                      {details.subtasks.filter((s) => s.done).length}/{details.subtasks.length}{" "}
                      subtasks
                    </span>
                  )}
                  {details.projectId && (
                    <Link href="/projects" className="underline">
                      {items(data, "project").find((p) => p.id === details.projectId)?.data.title ??
                        "Archived project"}
                    </Link>
                  )}
                </div>
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm">Log a work / study session</summary>
                  <SessionLogger task={task} date={date} pending={pending} mutate={mutate} />
                </details>
              </article>
            );
          })}
          {!tasks.length && <Empty text={`No ${status} tasks.`} />}
        </div>
      </Panel>
      {editing && (
        <TaskForm
          task={editing === "new" ? null : editing}
          data={data}
          pending={pending}
          close={() => setEditing(null)}
          save={(input) => mutate(input, () => setEditing(null))}
          archive={(id) =>
            window.confirm("Archive this task? You can restore it later.") &&
            mutate({ op: "task.archive", id, archive: true }, () => setEditing(null))
          }
        />
      )}
    </>
  );
}

function TaskForm({
  task,
  data,
  pending,
  close,
  save,
  archive,
}: {
  task: WorkspaceTask | null;
  data: WorkspaceData;
  pending: boolean;
  close: () => void;
  save: (input: unknown) => void;
  archive: (id: string) => void;
}) {
  const details = task?.details ?? emptyDetails;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nextDetails = {
      ...details,
      estimateMinutes: Number(fd.get("estimate") ?? 0),
      nextAction: String(fd.get("next") ?? ""),
      blocker: String(fd.get("blocker") ?? ""),
      projectId: fd.get("project") || null,
      subtasks: String(fd.get("subtasks") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((title) => ({
          title,
          done: details.subtasks.find((s) => s.title === title)?.done ?? false,
        })),
    };
    save({
      kind: task ? "task.update" : "task.create",
      payload: {
        ...(task
          ? { taskId: task.id, status: fd.get("status"), dueOn: fd.get("due") || null }
          : fd.get("due")
            ? { dueOn: fd.get("due") }
            : {}),
        title: fd.get("title"),
        taskKind: fd.get("kind"),
        priority: fd.get("priority"),
        notes: fd.get("notes") ?? "",
        details: nextDetails,
      },
    });
  }
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/40 p-3 pt-10 sm:p-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-form-title"
        className="mx-auto max-w-2xl rounded-2xl bg-background p-5 shadow-xl"
      >
        <div className="mb-4 flex justify-between gap-2">
          <h2 id="task-form-title" className="text-xl font-semibold">
            {task ? "Edit task" : "Add task"}
          </h2>
          <button className={buttonClass} disabled={pending} onClick={close}>
            Close
          </button>
        </div>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label text="Task">
              <input
                autoFocus
                name="title"
                required
                maxLength={120}
                className={inputClass}
                defaultValue={task?.title}
              />
            </Label>
          </div>
          <Label text="Type">
            <select className={inputClass} name="kind" defaultValue={task?.kind ?? "other"}>
              {["errand", "assignment", "exam", "chore", "other"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Label>
          <Label text="Priority">
            <select
              className={inputClass}
              name="priority"
              defaultValue={task?.priority ?? "medium"}
            >
              {["high", "medium", "low"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Label>
          <Label text="Due date">
            <input name="due" type="date" className={inputClass} defaultValue={task?.dueOn ?? ""} />
          </Label>
          {task && (
            <Label text="Status">
              <select name="status" className={inputClass} defaultValue={task.status}>
                {["open", "parked", "done"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Label>
          )}
          <Label text="Estimated minutes">
            <input
              name="estimate"
              type="number"
              min="0"
              step="1"
              className={inputClass}
              defaultValue={details.estimateMinutes}
            />
          </Label>
          <Label text="Project">
            <select name="project" className={inputClass} defaultValue={details.projectId ?? ""}>
              <option value="">None</option>
              {items(data, "project").map((p) => (
                <option key={p.id} value={p.id}>
                  {p.data.title}
                </option>
              ))}
            </select>
          </Label>
          <Label text="Next action">
            <input
              name="next"
              maxLength={300}
              className={inputClass}
              defaultValue={details.nextAction}
            />
          </Label>
          <Label text="Blocker">
            <input
              name="blocker"
              maxLength={300}
              className={inputClass}
              defaultValue={details.blocker}
            />
          </Label>
          <div className="sm:col-span-2">
            <Label text="Subtasks (one per line)">
              <textarea
                name="subtasks"
                rows={4}
                className={inputClass}
                defaultValue={details.subtasks.map((s) => s.title).join("\n")}
              />
            </Label>
          </div>
          <div className="sm:col-span-2">
            <Label text="Notes">
              <textarea
                name="notes"
                rows={3}
                maxLength={1000}
                className={inputClass}
                defaultValue={task?.notes ?? ""}
              />
            </Label>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button className={primaryClass} disabled={pending}>
              Save task
            </button>
            {task && (
              <button
                type="button"
                className={buttonClass}
                disabled={pending}
                onClick={() => archive(task.id)}
              >
                Archive
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

function SessionLogger({
  task,
  date,
  pending,
  mutate,
}: {
  task: WorkspaceTask;
  date: string;
  pending: boolean;
  mutate: (input: unknown, done?: () => void) => void;
}) {
  const [started, setStarted] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [started]);
  const details = task.details ?? emptyDetails;
  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-3">
        <button
          className={buttonClass}
          disabled={pending}
          onClick={() => {
            setStarted(started ? null : Date.now());
            if (!started) setElapsed(0);
          }}
        >
          {started ? "Stop timer" : "Start timer"}
        </button>
        <span className="font-mono text-sm">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </span>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          mutate(
            {
              kind: "task.update",
              payload: {
                taskId: task.id,
                details: {
                  ...details,
                  sessions: [
                    ...details.sessions,
                    {
                      date: fd.get("date"),
                      minutes: Number(fd.get("minutes")),
                      notes: String(fd.get("notes") ?? ""),
                    },
                  ],
                },
              },
            },
            () => {
              form.reset();
              setElapsed(0);
              setStarted(null);
            },
          );
        }}
      >
        <Label text="Date">
          <input type="date" required name="date" className={inputClass} defaultValue={date} />
        </Label>
        <Label text="Minutes">
          <input
            type="number"
            required
            name="minutes"
            min="1"
            max="1440"
            step="1"
            key={Math.ceil(elapsed / 60)}
            defaultValue={Math.max(1, Math.ceil(elapsed / 60))}
            className={inputClass}
          />
        </Label>
        <Label text="Session notes">
          <input name="notes" maxLength={1000} className={inputClass} />
        </Label>
        <button disabled={pending} className={primaryClass}>
          Save session
        </button>
      </form>
      {details.sessions
        .slice(-5)
        .reverse()
        .map((s, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            {s.date} · {s.minutes} minutes{s.notes ? ` · ${s.notes}` : ""}
          </p>
        ))}
    </div>
  );
}

function ReviewOverview({
  data,
  date,
  create,
  mutate,
}: {
  data: WorkspaceData;
  date: string;
  create: (type: LifeType, values?: Partial<LifeRecord>) => void;
  mutate: (input: unknown, done?: () => void) => void;
}) {
  const from = format(addDays(parseISO(date), -6), "yyyy-MM-dd");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<string[]>([]);
  const [period, setPeriod] = useState<"day" | "week" | "season">("week");
  const periodFrom =
    period === "day"
      ? date
      : period === "season"
        ? format(addDays(parseISO(date), -89), "yyyy-MM-dd")
        : from;
  const inPeriod = (d: string) => d >= periodFrom && d <= date;
  const taskRows = data.tasks.filter((t) => !t.archivedAt);
  const overdue = taskRows.filter((t) => t.status === "open" && t.dueOn && t.dueOn < date);
  const state = items(data, "state").filter((r) => inPeriod(r.data.date));
  const skippedRoutines = items(data, "routine_run").filter(
    (r) => inPeriod(r.data.date) && r.data.outcome !== "done",
  );
  const partialWorkouts = items(data, "workout").filter(
    (r) => inPeriod(r.data.date) && r.data.outcome !== "done",
  );
  const cards = [
    ...overdue.slice(0, 10).map((t) => ({
      id: t.id,
      title: `Choose a next step for ${t.title}`,
      evidence: `Due ${t.dueOn}; still open.`,
      href: "/tasks",
      action: "Park for now",
      input: { kind: "task.update", payload: { taskId: t.id, status: "parked" } },
    })),
    ...skippedRoutines.slice(0, 5).map((r) => ({
      id: r.id,
      title: `Try a smaller ${r.data.title}`,
      evidence: `You logged ${r.data.outcome} on ${r.data.date}.`,
      href: "/routines",
      action: "Open minimum version",
      input: null,
    })),
    ...partialWorkouts.slice(0, 3).map((r) => ({
      id: r.id,
      title: `Make room for ${r.data.title}`,
      evidence: `You logged ${r.data.outcome} on ${r.data.date}.`,
      href: "/fitness",
      action: "Review next session",
      input: null,
    })),
  ].filter((c) => !dismissed.includes(c.id));
  const evidence = [
    ...state.map((r) => r.id),
    ...skippedRoutines.map((r) => r.id),
    ...partialWorkouts.map((r) => r.id),
    ...overdue.map((t) => t.id),
  ].slice(0, 100);
  return (
    <Panel
      title="Evidence and next steps"
      action={
        <div className="flex gap-1">
          {(["day", "week", "season"] as const).map((p) => (
            <button
              className={`${buttonClass} ${period === p ? "bg-muted" : ""}`}
              key={p}
              onClick={() => setPeriod(p)}
            >
              {human(p)}
            </button>
          ))}
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">
        {periodFrom} through {date} · These suggestions use recorded facts. They do not infer your
        mood or health.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-3">
          <p className="text-2xl font-semibold">
            {taskRows.filter((t) => t.status === "done").length}
          </p>
          <p className="text-xs text-muted-foreground">Tasks currently completed (all time)</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-2xl font-semibold">
            {
              items(data, "routine_run").filter(
                (r) => inPeriod(r.data.date) && r.data.outcome === "done",
              ).length
            }
          </p>
          <p className="text-xs text-muted-foreground">Routine variants completed in this period</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-2xl font-semibold">
            {
              items(data, "workout").filter(
                (r) => inPeriod(r.data.date) && r.data.outcome === "done",
              ).length
            }
          </p>
          <p className="text-xs text-muted-foreground">Sessions completed in this period</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.id} className="space-y-3 rounded-xl border p-4">
            <h3 className="font-medium">{card.title}</h3>
            <p className="text-sm text-muted-foreground">Evidence: {card.evidence}</p>
            <div className="flex flex-wrap gap-2">
              {card.input ? (
                <button
                  className={primaryClass}
                  onClick={() =>
                    mutate(card.input, () => {
                      setDismissed([...dismissed, card.id]);
                      setDecisions([...decisions, `${card.title}: parked after review`]);
                    })
                  }
                >
                  {card.action}
                </button>
              ) : (
                <Link className={primaryClass} href={card.href}>
                  {card.action}
                </Link>
              )}
              <Link className={buttonClass} href={card.href}>
                Edit plan
              </Link>
              <button
                className={buttonClass}
                onClick={() => {
                  setDismissed([...dismissed, card.id]);
                  setDecisions([...decisions, `${card.title}: dismissed`]);
                }}
              >
                Dismiss
              </button>
              <button
                className={buttonClass}
                onClick={() => {
                  setDismissed([...dismissed, card.id]);
                  setDecisions([...decisions, `${card.title}: revisit later`]);
                }}
              >
                Snooze this review
              </button>
            </div>
          </div>
        ))}
      </div>
      {!cards.length && (
        <Empty text="No recovery suggestions from the current records. You can still save your own review." />
      )}
      <div className="space-y-2">
        {state.map((row) => (
          <p key={row.id} className="text-sm">
            <Link className="underline" href="/mind">
              {row.data.date}
            </Link>{" "}
            ·{" "}
            {[
              row.data.sleepHours === null ? "" : `${row.data.sleepHours} hours sleep`,
              row.data.energy,
              row.data.mood,
              row.data.capacity,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ))}
      </div>
      <button
        className={primaryClass}
        onClick={() =>
          create("review", {
            title: `${human(period)} review · ${date}`,
            from: periodFrom,
            to: date,
            notes: `${overdue.length} open overdue tasks; ${skippedRoutines.length} partial or skipped routine logs; ${state.length} state notes in this period.`,
            decisions: decisions.join("\n"),
            citedIds: evidence,
          })
        }
      >
        Save this review with evidence
      </button>
    </Panel>
  );
}

function ObservationEditor({
  observation,
  mutate,
  pending,
}: {
  observation: WorkspaceData["observations"][number];
  mutate: (input: unknown, done?: () => void) => void;
  pending: boolean;
}) {
  return (
    <details className="rounded-xl border p-3">
      <summary className="cursor-pointer text-sm">
        {human(observation.category)}: “{observation.valueText}”
      </summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          mutate({
            op: "observation.save",
            id: observation.id,
            category: form.get("category"),
            valueText: form.get("valueText"),
            occurredOn: form.get("date"),
          });
        }}
      >
        <label className="block text-sm">
          Category
          <select name="category" className={inputClass} defaultValue={observation.category}>
            {["sleep", "energy", "capacity", "stress", "note"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Date
          <input
            name="date"
            type="date"
            required
            className={inputClass}
            defaultValue={observation.occurredOn}
          />
        </label>
        <label className="block text-sm">
          Your words
          <textarea
            name="valueText"
            required
            maxLength={200}
            className={inputClass}
            defaultValue={observation.valueText}
          />
        </label>
        <div className="flex gap-2">
          <button className={buttonClass} disabled={pending}>
            Save correction
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={pending}
            onClick={() =>
              window.confirm("Archive this observation?") &&
              mutate({ op: "observation.archive", id: observation.id, archive: true })
            }
          >
            Archive
          </button>
        </div>
      </form>
    </details>
  );
}

function HistoryBoard({
  data,
  room,
  mutate,
  pending,
}: {
  data: WorkspaceData;
  room: string;
  mutate: (input: unknown, done?: () => void) => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [sensitive, setSensitive] = useState(false);
  const [collection, setCollection] = useState("");
  const [importText, setImportText] = useState("");
  const [confirmImport, setConfirmImport] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const sensitiveTypes = [
    "state",
    "meal",
    "body_log",
    "nutrition_targets",
    "workout",
    "food",
    "meal_template",
    "observation",
  ];
  const latest = new Set<string>();
  const rows = data.history.filter((h) => {
    if (latest.has(`${h.entityType}:${h.entityId}`)) return false;
    latest.add(`${h.entityType}:${h.entityId}`);
    return true;
  });
  const latestIds = new Set(rows.map((h) => h.id));
  const records = data.records.filter(
    (r) =>
      r.archivedAt &&
      (sensitive || !sensitiveTypes.includes(r.data.type)) &&
      (kind === "all" || r.data.type === kind) &&
      (!collection || r.data.collection === collection) &&
      `${r.data.title} ${r.data.notes}`.toLowerCase().includes(query.toLowerCase()),
  );
  const history = data.history.filter((h) => {
    const row = h.after as {
      type?: string;
      title?: string;
      data?: { type?: string; title?: string };
    } | null;
    const type = row?.data?.type ?? h.entityType;
    return (
      (sensitive || !sensitiveTypes.includes(type)) &&
      (kind === "all" || type === kind) &&
      JSON.stringify(h.after).toLowerCase().includes(query.toLowerCase())
    );
  });
  async function importBackup() {
    try {
      const value: unknown = JSON.parse(importText);
      const { importWorkspaceAction } = await import("./importActions");
      const result = await importWorkspaceAction(value);
      setImportMessage(result.message);
      if (result.ok) window.location.reload();
    } catch {
      setImportMessage("Choose a valid NOVA backup JSON file");
    }
  }
  return (
    <>
      <Panel
        title={room === "archive" ? "Archived records" : "Change history"}
        action={
          <Link className={buttonClass} href="/api/export" download prefetch={false}>
            Download full JSON backup
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search history"
          />
          <select
            className={inputClass}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="Filter record type"
          >
            <option value="all">All types</option>
            {["task", "schedule_block", "observation", ...Object.keys(names)].map((t) => (
              <option key={t} value={t}>
                {human(t)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sensitive}
              onChange={(e) => setSensitive(e.target.checked)}
            />
            Include sensitive records
          </label>
        </div>
        {room === "archive" && (
          <>
            <select
              aria-label="Archive collection"
              className={inputClass}
              value={collection}
              onChange={(event) => setCollection(event.target.value)}
            >
              <option value="">All collections</option>
              {[
                ...new Set(
                  data.records
                    .map((row) => row.data.collection)
                    .filter((value): value is string => Boolean(value)),
                ),
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <SeasonArchive
              data={data}
              includeSensitive={sensitive}
              mutate={mutate}
              pending={pending}
            />
          </>
        )}
        {room === "archive" ? (
          <div className="space-y-3">
            {records.map((row) => (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border p-4"
                key={row.id}
              >
                <div>
                  <h3 className="font-medium">{row.data.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {names[row.data.type]} · {row.archivedAt?.slice(0, 10)}
                  </p>
                </div>
                <button
                  disabled={pending}
                  className={buttonClass}
                  onClick={() => mutate({ op: "record.archive", id: row.id, archive: false })}
                >
                  Restore
                </button>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    mutate({
                      op: "record.collection",
                      id: row.id,
                      collection: form.get("collection"),
                    });
                  }}
                >
                  <input
                    aria-label={`Collection for ${row.data.title}`}
                    name="collection"
                    maxLength={120}
                    className={inputClass}
                    placeholder="Collection"
                    defaultValue={row.data.collection ?? ""}
                  />
                  <button disabled={pending} className={buttonClass}>
                    Move
                  </button>
                </form>
              </div>
            ))}
            {sensitive &&
              data.observations
                .filter(
                  (o) =>
                    o.archivedAt &&
                    (kind === "all" || kind === "observation") &&
                    o.valueText.toLowerCase().includes(query.toLowerCase()),
                )
                .map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between gap-3 rounded-xl border p-4"
                  >
                    <p>
                      {human(o.category)}: “{o.valueText}” · {o.occurredOn}
                    </p>
                    <button
                      disabled={pending}
                      className={buttonClass}
                      onClick={() =>
                        mutate({ op: "observation.archive", id: o.id, archive: false })
                      }
                    >
                      Restore observation
                    </button>
                  </div>
                ))}
            {data.tasks
              .filter(
                (t) =>
                  t.archivedAt &&
                  (kind === "all" || kind === "task") &&
                  t.title.toLowerCase().includes(query.toLowerCase()),
              )
              .map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-4"
                >
                  <p>
                    {t.title} <span className="text-xs text-muted-foreground">· Task</span>
                  </p>
                  <button
                    disabled={pending}
                    className={buttonClass}
                    onClick={() => mutate({ op: "task.archive", id: t.id, archive: false })}
                  >
                    Restore
                  </button>
                </div>
              ))}
            {data.schedule
              .filter(
                (b) =>
                  b.archivedAt &&
                  (kind === "all" || kind === "schedule_block") &&
                  b.title.toLowerCase().includes(query.toLowerCase()),
              )
              .map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-4"
                >
                  <p>
                    {b.title}{" "}
                    <span className="text-xs text-muted-foreground">
                      · {b.date} {b.start}
                    </span>
                  </p>
                  <button
                    disabled={pending}
                    className={buttonClass}
                    onClick={() => mutate({ op: "schedule.archive", id: b.id, archive: false })}
                  >
                    Restore occurrence
                  </button>
                </div>
              ))}
            {!records.length &&
              !data.tasks.some((t) => t.archivedAt) &&
              !data.schedule.some((b) => b.archivedAt) && (
                <Empty text="No archived records matching this view." />
              )}
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((change) => {
              const after = change.after as {
                title?: string;
                data?: { title?: string; type?: string };
              } | null;
              return (
                <details className="rounded-xl border p-4" key={change.id}>
                  <summary className="cursor-pointer text-sm">
                    <span className="font-medium">
                      {after?.data?.title ?? after?.title ?? human(change.entityType)}
                    </span>{" "}
                    · {change.action} · {change.origin}{" "}
                    <span className="text-xs text-muted-foreground">
                      · {new Date(change.createdAt).toLocaleString()}
                    </span>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium">Before</p>
                      <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-muted p-3 text-xs">
                        {JSON.stringify(change.before, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium">After</p>
                      <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-muted p-3 text-xs">
                        {JSON.stringify(change.after, null, 2)}
                      </pre>
                    </div>
                  </div>
                  {latestIds.has(change.id) &&
                    change.origin !== "undo" &&
                    ["life_record", "task", "schedule_block", "observation"].includes(
                      change.entityType,
                    ) && (
                      <button
                        disabled={pending}
                        className={`${buttonClass} mt-3`}
                        onClick={() =>
                          window.confirm("Undo this latest change?") &&
                          mutate({ op: "undo", changeId: change.id })
                        }
                      >
                        Undo latest change
                      </button>
                    )}
                </details>
              );
            })}
            {!history.length && <Empty text="No changes matching this view." />}
          </div>
        )}
      </Panel>
      <Panel title="Backup import">
        <p className="text-sm text-muted-foreground">
          Import a NOVA JSON backup as new records. Existing records stay available. Imported
          changes are validated and audited together.
        </p>
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Choose backup file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file && file.size <= 5_000_000) {
              setImportText(await file.text());
              setConfirmImport(false);
              setImportMessage("");
            } else setImportMessage("Choose a JSON file smaller than 5 MB");
          }}
        />
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmImport}
            onChange={(e) => setConfirmImport(e.target.checked)}
          />
          I reviewed this backup and want to add its records to this account.
        </label>
        <button
          className={primaryClass}
          disabled={pending || !confirmImport || !importText}
          onClick={importBackup}
        >
          Import backup
        </button>
        {importMessage && (
          <p className="text-sm" role="status">
            {importMessage}
          </p>
        )}
      </Panel>
    </>
  );
}

function SeasonArchive({
  data,
  includeSensitive,
  mutate,
  pending,
}: {
  data: WorkspaceData;
  includeSensitive: boolean;
  mutate: (input: unknown, done?: () => void) => void;
  pending: boolean;
}) {
  const [cutoff, setCutoff] = useState(format(addDays(parseISO(data.today), -90), "yyyy-MM-dd"));
  const [show, setShow] = useState(false);
  const oldRecords = data.records.filter(
    (row) =>
      !row.archivedAt &&
      (includeSensitive || !["state", "meal", "workout", "body_log"].includes(row.data.type)) &&
      (("date" in row.data && row.data.date < cutoff) ||
        ("to" in row.data && row.data.to < cutoff)),
  );
  const oldTasks = data.tasks.filter(
    (task) => !task.archivedAt && task.status === "done" && task.dueOn && task.dueOn < cutoff,
  );
  const oldBlocks = data.schedule.filter((block) => !block.archivedAt && block.date < cutoff);
  const operations = [
    ...oldRecords.map((row) => ({ op: "record.archive", id: row.id, archive: true })),
    ...oldTasks.map((row) => ({ op: "task.archive", id: row.id, archive: true })),
    ...oldBlocks.map((row) => ({ op: "schedule.archive", id: row.id, archive: true })),
  ];
  return (
    <details className="rounded-xl border p-3">
      <summary className="cursor-pointer text-sm font-medium">Seasonal cleanup</summary>
      <div className="mt-3 space-y-3">
        <Label text="Archive completed / dated records before">
          <input
            type="date"
            className={inputClass}
            value={cutoff}
            onChange={(event) => {
              setCutoff(event.target.value);
              setShow(false);
            }}
          />
        </Label>
        <button className={buttonClass} onClick={() => setShow(true)}>
          Preview cleanup
        </button>
        {show && (
          <>
            <p className="text-sm">
              {operations.length} records will move to Archive. Restore remains available.
            </p>
            <ul className="max-h-48 overflow-auto text-sm text-muted-foreground">
              {[
                ...oldRecords.map((r) => r.data.title),
                ...oldTasks.map((r) => r.title),
                ...oldBlocks.map((r) => `${r.title} · ${r.date}`),
              ].map((title, index) => (
                <li key={index}>{title}</li>
              ))}
            </ul>
            <button
              disabled={pending || !operations.length || operations.length > 500}
              className={primaryClass}
              onClick={() => mutate(operations, () => setShow(false))}
            >
              Archive these records
            </button>
            {operations.length > 500 && (
              <p className="text-sm">Choose an earlier cutoff to archive at most 500 at a time.</p>
            )}
          </>
        )}
      </div>
    </details>
  );
}

export function Sandbox({ data }: { data: WorkspaceData }) {
  const seed = (): WorkspaceData => {
    const habitId = "10000000-0000-4000-8000-000000000001";
    const routineId = "10000000-0000-4000-8000-000000000002";
    const row = (id: string, record: LifeRecord): LifeRow => ({
      id,
      data: record,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return {
      today: data.today,
      timezone: data.timezone,
      authority: "ask",
      observations: [],
      captures: [],
      history: [],
      schedule: [
        {
          id: "10000000-0000-4000-8000-000000000003",
          title: "Sam's fictional class",
          kind: "class",
          date: data.today,
          start: "10:00",
          end: "11:00",
          fixed: true,
          seriesId: null,
          archivedAt: null,
          updatedAt: new Date().toISOString(),
        },
      ],
      tasks: [
        {
          id: "10000000-0000-4000-8000-000000000004",
          title: "Sam's fictional lab report",
          kind: "assignment",
          priority: "medium",
          status: "open",
          dueOn: format(addDays(parseISO(data.today), 2), "yyyy-MM-dd"),
          notes: "Fictional sample",
          details: {
            ...emptyDetails,
            estimateMinutes: 60,
            nextAction: "Outline the introduction",
            subtasks: [
              { title: "Outline", done: false },
              { title: "Write draft", done: false },
            ],
          },
          archivedAt: null,
        },
      ],
      records: [
        row(habitId, {
          type: "habit",
          title: "Read a page",
          notes: "Fictional sample",
          tier: "floor",
          unit: "count",
          target: 1,
          days: [0, 1, 2, 3, 4, 5, 6],
          anchor: "After breakfast",
        }),
        row(routineId, {
          type: "routine",
          title: "Prepare for tomorrow",
          notes: "Fictional sample",
          anchor: "Evening",
          days: [0, 1, 2, 3, 4, 5, 6],
          minutes: 10,
          full: ["Check tomorrow's schedule", "Pack bag", "Set out clothes"],
          short: ["Check tomorrow's schedule", "Pack bag"],
          minimum: ["Check tomorrow's schedule"],
        }),
      ],
    };
  };
  const [snapshot, setSnapshot] = useState<WorkspaceData>(seed);
  const [sandboxRoom, setSandboxRoom] = useState("tasks");
  const [importError, setImportError] = useState("");
  async function simulate(input: unknown): Promise<{ ok: boolean; message: string }> {
    const { WorkspaceOperation, LifeRecord } = await import("@/contracts/life");
    const { DomainCommand } = await import("@/contracts/commands");
    const next = structuredClone(snapshot);
    try {
      for (const operation of Array.isArray(input) ? input : [input]) {
        const parsed = WorkspaceOperation.safeParse(operation);
        if (parsed.success) {
          const op = parsed.data;
          const now = new Date().toISOString();
          if (op.op === "record.save") {
            const record = LifeRecord.parse(op.record);
            const existing = op.id
              ? next.records.find((r) => r.id === op.id)
              : next.records.find(
                  (r) =>
                    !r.archivedAt &&
                    ((record.type === "habit_log" &&
                      r.data.type === "habit_log" &&
                      record.habitId === r.data.habitId &&
                      record.date === r.data.date) ||
                      (record.type === "routine_run" &&
                        r.data.type === "routine_run" &&
                        record.routineId === r.data.routineId &&
                        record.date === r.data.date)),
                );
            if (existing) {
              existing.data = record;
              existing.updatedAt = now;
            } else
              next.records.unshift({
                id: crypto.randomUUID(),
                data: record,
                archivedAt: null,
                createdAt: now,
                updatedAt: now,
              });
          } else if (op.op === "money.pay") {
            const row = next.records.find((r) => r.id === op.id);
            if (!row || row.data.type !== "money" || row.data.direction !== "bill")
              throw new Error("Bill unavailable");
            if (!row.data.paid) {
              const bill = row.data;
              row.data = { ...bill, paid: true };
              if (bill.recurrence !== "none") {
                const { nextBillDate } = await import("@/domain/life");
                next.records.unshift({
                  ...row,
                  id: crypto.randomUUID(),
                  data: { ...bill, date: nextBillDate(bill.date, bill.recurrence), paid: false },
                });
              }
            }
          } else if (op.op === "record.collection") {
            const row = next.records.find((r) => r.id === op.id);
            if (row) row.data.collection = op.collection;
          } else if (op.op === "observation.save" || op.op === "observation.archive") {
            const row = next.observations.find((r) => r.id === op.id);
            if (!row) throw new Error("Observation unavailable");
            if (op.op === "observation.archive") row.archivedAt = op.archive ? now : null;
            else
              Object.assign(row, {
                category: op.category,
                valueText: op.valueText,
                occurredOn: op.occurredOn,
              });
          } else if (op.op === "record.archive") {
            const record = next.records.find((r) => r.id === op.id);
            if (record) record.archivedAt = op.archive ? now : null;
          } else if (op.op === "task.archive") {
            const task = next.tasks.find((r) => r.id === op.id);
            if (task) task.archivedAt = op.archive ? now : null;
          } else if (op.op === "schedule.archive") {
            const block = next.schedule.find((r) => r.id === op.id);
            if (block) block.archivedAt = op.archive ? now : null;
          } else if (op.op === "schedule.save") {
            if (op.block.end <= op.block.start) throw new Error("End must follow start");
            let dates = [op.block.date];
            if (op.repeat) {
              const until = parseISO(op.repeat.until);
              const start = parseISO(op.block.date);
              if (until < start || until.getTime() - start.getTime() > 366 * 86400000)
                throw new Error("Repeat through a date within one year");
              dates = eachDayOfInterval({ start, end: until })
                .filter((d) => op.repeat!.days.includes(d.getDay()))
                .map((d) => format(d, "yyyy-MM-dd"));
              if (dates.length > 200) throw new Error("Limit the series to 200 occurrences");
            }
            for (const date of dates) {
              const block = op.id ? next.schedule.find((r) => r.id === op.id) : null;
              const value = {
                id: block?.id ?? crypto.randomUUID(),
                title: op.block.title,
                kind: op.block.blockKind,
                date,
                start: op.block.start,
                end: op.block.end,
                fixed: op.block.fixed,
                seriesId: null,
                archivedAt: null,
                updatedAt: now,
              };
              if (block) Object.assign(block, value);
              else next.schedule.push(value);
            }
          } else throw new Error("This control is available in the saved app");
        } else {
          const command = DomainCommand.parse(operation);
          if (command.kind === "task.create")
            next.tasks.unshift({
              id: crypto.randomUUID(),
              title: command.payload.title,
              kind: command.payload.taskKind,
              priority: command.payload.priority ?? "medium",
              status: "open",
              dueOn: command.payload.dueOn ?? null,
              notes: command.payload.notes ?? "",
              details: command.payload.details ?? structuredClone(emptyDetails),
              archivedAt: null,
            });
          else if (command.kind === "task.update") {
            const task = next.tasks.find((t) => t.id === command.payload.taskId);
            if (!task) throw new Error("Task unavailable");
            const { taskId, taskKind, ...patch } = command.payload;
            Object.assign(task, patch, ...(taskKind ? [{ kind: taskKind }] : []));
            void taskId;
          } else throw new Error("Use the sandbox's room controls");
        }
      }
      setSnapshot(next);
      return { ok: true, message: "Saved in the sandbox only" };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Check the fields" };
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nova-sandbox.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-5">
      <Panel title="Fictional workspace">
        <p className="text-sm text-muted-foreground">
          This workspace stays in this browser tab. Refreshing resets it. It never saves to your
          account or calls AI.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            "tasks",
            "schedule",
            "habits",
            "routines",
            "fitness",
            "diet",
            "mind",
            "projects",
            "money",
            "review",
          ].map((room) => (
            <button
              className={`${buttonClass} ${sandboxRoom === room ? "bg-muted" : ""}`}
              key={room}
              onClick={() => setSandboxRoom(room)}
            >
              {human(room)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            className={buttonClass}
            onClick={() => window.confirm("Reset the sandbox?") && setSnapshot(seed())}
          >
            Reset fictional day
          </button>
          <button className={buttonClass} onClick={download}>
            Export sandbox
          </button>
          {data.records.length + data.tasks.length + data.schedule.length > 0 && (
            <button
              className={buttonClass}
              onClick={() =>
                window.confirm(
                  "Copy your current records into this temporary sandbox? Changes here will stay in this tab.",
                ) && setSnapshot({ ...structuredClone(data), history: [], captures: [] })
              }
            >
              Try a copy of my workspace
            </button>
          )}
        </div>
        <label className="block text-sm">
          Import a sandbox export
          <input
            type="file"
            accept="application/json,.json"
            className="mt-2 block text-sm"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 5_000_000) throw new Error("Choose a JSON file smaller than 5 MB");
                const { SandboxSnapshot } = await import("@/contracts/life");
                const parsed = SandboxSnapshot.parse(JSON.parse(await file.text()));
                setSnapshot({ ...parsed, authority: "ask", history: [], captures: [] });
                setImportError("");
              } catch {
                setImportError("Choose a valid NOVA sandbox export, up to 5 MB");
              }
            }}
          />
        </label>
        {importError && (
          <p role="alert" className="text-sm">
            {importError}
          </p>
        )}
      </Panel>
      <div className="rounded-2xl border-2 border-dashed border-primary/30 p-3 sm:p-5">
        <LifeWorkspace key={sandboxRoom} room={sandboxRoom} data={snapshot} act={simulate} />
      </div>
    </div>
  );
}
