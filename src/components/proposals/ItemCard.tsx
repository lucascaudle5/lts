import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { BLOCK_KIND_ACCENT, BLOCK_KIND_LABEL } from "@/components/today/labels";
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

/** What the change is, in plain words instead of `schedule_block · create`. */
function kindWords(item: ProposalItem): string {
  return item.kind === "schedule_block.create"
    ? "Add to your schedule"
    : item.kind === "task.create"
      ? "Add as a task"
      : "Keep what you said";
}

/** Each kind borrows a room hue: blocks use their own kind's, tasks plan-blue, notes self-purple. */
function tint(item: ProposalItem): string {
  if (item.kind === "schedule_block.create") {
    return BLOCK_KIND_ACCENT[item.payload.blockKind ?? "personal"];
  }
  return item.kind === "task.create"
    ? "[--k:var(--blue)] [--k-soft:var(--blue-soft)]"
    : "[--k:var(--purple)] [--k-soft:var(--purple-soft)]";
}

/** Plain words for where the item stands. A gap is "Needs a time", never a failure badge. */
export function statusWords(item: ProposalItem): {
  text: string;
  tone: "ok" | "wait" | "done" | "quiet";
} {
  switch (item.status) {
    case "ready":
      return { text: "Ready to add", tone: "ok" };
    case "needs_input": {
      const paths = item.missingSlots.map((slot) => slot.path.toLowerCase()).join(" ");
      return {
        text: /start|end|time/.test(paths)
          ? "Needs a time"
          : /date|due|day|occurred/.test(paths)
            ? "Needs a day"
            : "Needs a detail",
        tone: "wait",
      };
    }
    case "approved":
    case "applied":
      return { text: "Added", tone: "done" };
    case "rejected":
      return { text: "Set aside", tone: "quiet" };
    default:
      return { text: "Couldn't add this one", tone: "quiet" };
  }
}

const STATUS_TONE = {
  ok: "bg-success-soft text-success",
  wait: "bg-gold-soft text-gold-text",
  done: "bg-success-soft text-success",
  quiet: "bg-surface-3 text-ink-soft",
} as const;

function Preview({ item }: { item: ProposalItem }) {
  if (item.kind === "observation.record") {
    return (
      <div className="space-y-1.5">
        <DiffRow
          label="Say"
          value={`\u201c${item.payload.valueText ?? "Observation"}\u201d`}
          serif
        />
        <DiffRow label="Day" value={summary(item)} />
      </div>
    );
  }
  const detail =
    item.kind === "schedule_block.create"
      ? `${itemTitle(item)} \u00b7 ${BLOCK_KIND_LABEL[item.payload.blockKind ?? "personal"]}, ${item.payload.fixed ? "fixed" : "flexible"}`
      : itemTitle(item);
  return (
    <div className="space-y-1.5">
      <DiffRow label="Add" value={detail} />
      <DiffRow label="When" value={summary(item)} />
    </div>
  );
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
    <article
      className={cn(
        "space-y-4 rounded-2xl border border-l-[6px] border-l-(--k) bg-card p-4 shadow-paper sm:p-5",
        tint(item),
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-ink-soft">{kindWords(item)}</p>
          <h2 className="mt-1 text-xl leading-7 break-words">{itemTitle(item)}</h2>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            STATUS_TONE[statusWords(item).tone],
          )}
        >
          {statusWords(item).text}
        </span>
      </header>

      <div className="space-y-1.5">
        <p className="eyebrow text-muted-foreground">What will change</p>
        <div className="rounded-xl border border-(--k)/40 bg-(--k-soft) p-2">
          <Preview item={item} />
        </div>
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
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"
                  name="title"
                  defaultValue={item.payload.title ?? ""}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Kind</span>
                <select
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"
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
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"
                  name="date"
                  type="date"
                  defaultValue={item.payload.date ?? ""}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Starts</span>
                <input
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"
                  name="start"
                  type="time"
                  defaultValue={item.payload.start ?? ""}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Ends</span>
                <input
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"
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
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"
                  name="title"
                  defaultValue={item.payload.title ?? ""}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Kind</span>
                <select
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"
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
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"
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
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"
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
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"
                  name="occurredOn"
                  type="date"
                  defaultValue={item.payload.occurredOn ?? ""}
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>Your words</span>
                <textarea
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2"
                  name="valueText"
                  maxLength={200}
                  defaultValue={item.payload.valueText ?? ""}
                />
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" size="lg">
              Save edits
            </Button>
          </div>
        </form>
      ) : null}

      {editable ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {item.status === "ready" ? (
            <form action={approveAction} className="contents">
              <input type="hidden" name="itemId" value={item.id} />
              <Button
                type="submit"
                variant="gold"
                size="lg"
                className="w-full sm:w-auto sm:min-w-44"
              >
                Approve this change
              </Button>
            </form>
          ) : null}
          <form action={rejectAction} className="contents">
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="captureId" value={captureId} />
            <Button
              type="submit"
              variant="ghost"
              size="lg"
              className="w-full text-ink-soft sm:w-auto"
            >
              Not this one
            </Button>
          </form>
        </div>
      ) : null}

      <p className="border-t pt-3 text-xs text-muted-foreground">
        Interpreted without AI · {item.provenance.confidence} confidence
      </p>
    </article>
  );
}
