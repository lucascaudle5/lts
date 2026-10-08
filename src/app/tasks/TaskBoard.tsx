import Link from "next/link";

import { parseISO, format } from "date-fns";

import { TASK_KIND_LABEL } from "@/components/today/labels";
import type { TaskPriority, TaskStatus } from "@/contracts/common";
import type { TaskRow as TaskRowData } from "@/server/repositories/tasks";

import { createTaskAction, updateTaskAction } from "./actions";

type TaskRow = TaskRowData & { today?: string };

const priorities: TaskPriority[] = ["high", "medium", "low"];
const statuses: TaskStatus[] = ["open", "done", "parked"];

function dateLabel(dueOn: string | null, today: string): string {
  if (!dueOn) return "No due date";
  if (dueOn < today) return `Overdue · Due ${format(parseISO(dueOn), "EEE, MMM d")}`;
  if (dueOn === today) return "Due today";
  return `Due ${format(parseISO(dueOn), "EEE, MMM d")}`;
}

function TaskEditor({ task }: { task: TaskRow }) {
  const dueText = dateLabel(task.dueOn, task.today ?? "");
  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{TASK_KIND_LABEL[task.kind]}</p>
          <p className="mt-0.5 font-medium break-words">{task.title}</p>
          {task.notes ? <p className="mt-1 text-sm text-muted-foreground">{task.notes}</p> : null}
          {task.captureId ? (
            <Link
              className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline"
              href={`/captures/${task.captureId}`}
            >
              From a capture
            </Link>
          ) : null}
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs ${task.dueOn && task.dueOn < (task.today ?? "") ? "border-amber-500/40 text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}
        >
          {dueText}
        </span>
      </div>
      <form action={updateTaskAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <input type="hidden" name="taskId" value={task.id} />
        <label className="space-y-1 text-xs font-medium">
          <span>Task</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="title"
            required
            maxLength={120}
            defaultValue={task.title}
          />
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span>Type</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="taskKind"
            defaultValue={task.kind}
          >
            {Object.entries(TASK_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span>Due date</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="dueOn"
            type="date"
            defaultValue={task.dueOn ?? ""}
          />
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span>Priority</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="priority"
            defaultValue={task.priority}
          >
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority[0]?.toUpperCase()}
                {priority.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span>Status</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            name="status"
            defaultValue={task.status}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status[0]?.toUpperCase()}
                {status.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
            type="submit"
          >
            Save task
          </button>
        </div>
        <label className="space-y-1 text-xs font-medium sm:col-span-2 lg:col-span-6">
          <span>Notes</span>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            name="notes"
            maxLength={1000}
            rows={2}
            defaultValue={task.notes ?? ""}
          />
        </label>
      </form>
    </li>
  );
}

function TaskSection({ title, tasks, today }: { title: string; tasks: TaskRow[]; today: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">{tasks.length}</span>
      </div>
      {tasks.length ? (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <TaskEditor key={task.id} task={{ ...task, today }} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
          No {title.toLowerCase()}.
        </p>
      )}
    </section>
  );
}

export function TaskBoard({
  tasks,
  today,
  invalid,
}: {
  tasks: TaskRow[];
  today: string;
  invalid: boolean;
}) {
  const openTasks = tasks.filter((task) => task.status === "open");
  const parkedTasks = tasks.filter((task) => task.status === "parked");
  const doneTasks = tasks.filter((task) => task.status === "done");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Tasks and assignments</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Keep the next step visible.
        </h1>
        <p className="text-sm text-muted-foreground">
          Due dates, priority, and status stay connected to Today. Parking a task keeps it available
          without leaving it in the active list.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="font-semibold">Add a task</h2>
        <form action={createTaskAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-sm font-medium">
            <span>What needs doing?</span>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              name="title"
              required
              maxLength={120}
              placeholder="Finish the lab report"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>Type</span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              name="taskKind"
              defaultValue="other"
            >
              {Object.entries(TASK_KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>Due date</span>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              name="dueOn"
              type="date"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>Priority</span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              name="priority"
              defaultValue="medium"
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority[0]?.toUpperCase()}
                  {priority.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              type="submit"
            >
              Add task
            </button>
          </div>
          <label className="space-y-1 text-sm font-medium sm:col-span-2 lg:col-span-5">
            <span>Notes (optional)</span>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              name="notes"
              maxLength={1000}
              rows={2}
            />
          </label>
        </form>
        {invalid ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            Check the task fields and try again.
          </p>
        ) : null}
      </section>

      <div className="space-y-8">
        <TaskSection title="Open tasks" tasks={openTasks} today={today} />
        <div className="grid gap-8 lg:grid-cols-2">
          <TaskSection title="Parked tasks" tasks={parkedTasks} today={today} />
          <TaskSection title="Completed tasks" tasks={doneTasks} today={today} />
        </div>
      </div>
    </div>
  );
}
