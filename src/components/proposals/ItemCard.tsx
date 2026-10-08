import type { ProposalItem } from "@/contracts/proposals";

import { DiffRow } from "./DiffRow";
import { SlotChip } from "./SlotChip";

type ServerAction = (formData: FormData) => void | Promise<void>;

const BLOCK_KINDS = ["work", "class", "exam", "fitness", "meal", "focus", "personal"] as const;
const TASK_KINDS = ["errand", "assignment", "exam", "chore", "other"] as const;
const OBSERVATION_CATEGORIES = ["energy", "sleep", "stress", "capacity", "note"] as const;

function itemTitle(item: ProposalItem): string {
  return item.kind === "schedule_block.create"
    ? (item.payload.title ?? "Schedule block")
    : item.kind === "task.create"
      ? (item.payload.title ?? "Task")
      : (item.payload.valueText ?? "Observation");
}

function summary(item: ProposalItem): string {
  if (item.kind === "schedule_block.create") {
    const { date, start, end } = item.payload;
    return (
      [date, start && end ? `${start}–${end}` : null].filter(Boolean).join(" · ") || "Needs details"
    );
  }
  if (item.kind === "task.create")
    return item.payload.dueOn ? `Due ${item.payload.dueOn}` : "No due date";
  return item.payload.occurredOn ?? "Observation date needed";
}

export function ItemCard({
  item,
  captureId,
  updateAction,
  approveAction,
  rejectAction,
}: {
  item: ProposalItem;
  captureId: string;
  updateAction: ServerAction;
  approveAction: ServerAction;
  rejectAction: ServerAction;
}) {
  const editable = item.status === "ready" || item.status === "needs_input";
  return (
    <article className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{itemTitle(item)}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{item.kind.replaceAll(".", " · ")}</p>
        </div>
        <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground capitalize">
          {item.status.replaceAll("_", " ")}
        </span>
      </header>

      <div className="space-y-2">
        <DiffRow label="Add" value={itemTitle(item)} />
        <DiffRow label="When" value={summary(item)} />
      </div>

      {item.missingSlots.length > 0 ? (
        <section aria-label="Information needed" className="space-y-2">
          <h3 className="text-sm font-medium">A few details are needed</h3>
          <ul className="space-y-2">
            {item.missingSlots.map((slot) => (
              <SlotChip key={slot.path} slot={slot} />
            ))}
          </ul>
        </section>
      ) : null}

      {item.warnings.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {item.warnings.map((warning, index) => (
            <li key={`${warning.code}-${index}`}>{warning.message}</li>
          ))}
        </ul>
      ) : null}

      {editable ? (
        <form action={updateAction} className="space-y-3 border-t pt-4">
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="captureId" value={captureId} />
          <input type="hidden" name="kind" value={item.kind} />
          {item.kind === "schedule_block.create" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Title</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  name="title"
                  defaultValue={item.payload.title ?? ""}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Kind</span>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  name="blockKind"
                  defaultValue={item.payload.blockKind ?? "personal"}
                >
                  {BLOCK_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Date</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  name="date"
                  type="date"
                  defaultValue={item.payload.date ?? ""}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Starts</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  name="start"
                  type="time"
                  defaultValue={item.payload.start ?? ""}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Ends</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  name="end"
                  type="time"
                  defaultValue={item.payload.end ?? ""}
                />
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm">
                <input
                  type="checkbox"
                  name="fixed"
                  value="true"
                  defaultChecked={item.payload.fixed ?? false}
                />
                Fixed appointment
              </label>
            </div>
          ) : item.kind === "task.create" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Title</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  name="title"
                  defaultValue={item.payload.title ?? ""}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Kind</span>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  name="taskKind"
                  defaultValue={item.payload.taskKind ?? "other"}
                >
                  {TASK_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Due date</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  name="dueOn"
                  type="date"
                  defaultValue={item.payload.dueOn ?? ""}
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Category</span>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  name="category"
                  defaultValue={item.payload.category ?? "note"}
                >
                  {OBSERVATION_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Date</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  name="occurredOn"
                  type="date"
                  defaultValue={item.payload.occurredOn ?? ""}
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>Your words</span>
                <textarea
                  className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
                  name="valueText"
                  maxLength={200}
                  defaultValue={item.payload.valueText ?? ""}
                />
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              type="submit"
            >
              Save edits
            </button>
          </div>
        </form>
      ) : null}

      {editable ? (
        <div className="flex flex-wrap gap-2">
          {item.status === "ready" ? (
            <form action={approveAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                type="submit"
              >
                Approve this change
              </button>
            </form>
          ) : null}
          <form action={rejectAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="captureId" value={captureId} />
            <button
              className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              type="submit"
            >
              Reject
            </button>
          </form>
        </div>
      ) : null}

      <p className="border-t pt-3 text-xs text-muted-foreground">
        Interpreted without AI · {item.provenance.confidence} confidence
      </p>
    </article>
  );
}
