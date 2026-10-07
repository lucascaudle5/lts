---
cursor:
  subagentId: "bc-ecf16999-a762-5e4d-83e3-ddf053109c87"
---

# v1 Vertical Slice: Capture → Proposals → Approval → Today

**Goal:** prove auth, persistence, typed domain data, the AI harness and tools, proposal/approval,
provenance, and a usable UI in one thin path. It is built across M2–M5 (see
[build-sequence.md](build-sequence.md)): M3 proves the loop with the deterministic parser, M4 swaps
in AI, M5 hardens it. The optional routine/recovery feature is M6.

**Invariant:** all consequential domain mutations go through the same audited mutation layer
(`runMutations`). AI-generated mutations additionally require proposal approval. The slice exercises
both paths: AI/parser proposal → approval → mutation layer, and manual edit/undo → mutation layer.

## User flow

1. **Sign in** — `/sign-in`, enter email, click the magic link → `/today`. The first sign-in creates
   the profile with the browser timezone.
2. **Today** — a capture box ("What's going on?") at the top, today's timeline, the next 7 days,
   open tasks, and today's self-reports.
3. **Capture** — type the messy sentence and press Enter. A `captures` row is stored and the user
   lands on `/captures/[id]` with a loading state. (If the narrow risk-language stop matches, the
   user instead sees a fixed message pointing to human help, with no AI call and no proposals.)
4. **Interpret** — the harness (or the parser) returns typed proposal items, validated, normalized,
   grounded, and slot-checked.
5. **Review** — the source text is shown once at the top. Items are grouped (Schedule / Tasks /
   About you). Each item shows a diff row of exactly what would be added, assumption chips, and
   empty slots.
6. **Decide** — fill slots, edit, approve, or reject per item, or use **Approve N ready**
   (health-adjacent items are never included in bulk approval; they need their own tap).
7. **Persist** — `approveItems` turns approved items into domain commands and calls the mutation
   layer, which validates, authorizes, writes domain rows, records `change_log` and provenance, and
   marks the items `applied`, all in one transaction.
8. **Today reflects it** — redirect to `/today` with "Added 5 changes" (with Undo from M5). Every
   added thing has a "from your note on Oct 7" provenance link.
9. **Manual path (M5)** — on Today, edit a block's time or delete a task directly (Article 6). The
   same mutation layer runs with `origin: manual`; it shows up in History like any approved change
   and can be undone.

## Worked example

Reference date **Wed 2026-10-07**, timezone `America/Chicago`. Input:

> Work Saturday 2–7, test Tuesday, gym Monday Wednesday Friday, need groceries, and I've been
> exhausted lately.

| #   | Kind                       | Payload                                                       | Status                      | Shown to user                                                                   |
| --- | -------------------------- | ------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| 1   | `schedule_block.create`    | Work · work · 2026-10-10 · 14:00–19:00 · fixed                | ready                       | `+ Sat Oct 10 · 2:00–7:00 PM · Work` · chips: _Saturday → Oct 10_, _assumed PM_ |
| 2   | `task.create`              | Test · exam · due 2026-10-13                                  | ready                       | `+ Exam due Tue Oct 13` · optional slot: _which class?_                         |
| 3–5 | `schedule_block.create` ×3 | Gym · fitness · 10-07 / 10-09 / 10-12                         | needs_input                 | `+ Gym · Wed Oct 7 · [start] – [end]` · chip _Wednesday = today?_               |
| 6   | `task.create`              | Groceries · errand                                            | ready                       | `+ Task: Groceries`                                                             |
| 7   | `observation.record`       | energy · "exhausted lately" · 2026-10-07 · sensitivity health | ready (individual approval) | `You said: "I've been exhausted lately"`. No score, no mode, no advice          |

What does **not** happen: no `capacity: 2`, no "Survival Day", no new routine, and nothing
written before approval. Recurring gym (one rule instead of three blocks) is in the backlog.

## Data objects

From `docs/ARCHITECTURE.md`. The slice uses: `profiles`, `captures`, `harness_runs`,
`proposal_items`, `schedule_blocks`, `tasks`, `observations`, `change_log`.

## Contracts (`src/contracts`)

```ts
const BlockKind = z.enum(["work", "class", "exam", "fitness", "meal", "focus", "personal"]);
const TaskKind = z.enum(["errand", "assignment", "exam", "chore", "other"]);
const ObservationCategory = z.enum(["energy", "sleep", "stress", "capacity", "note"]);

const ScheduleBlockCreate = z.object({
  title: z.string().min(1).max(120),
  blockKind: BlockKind,
  date: IsoDate, // YYYY-MM-DD in the user's timezone
  start: HhMm,
  end: HhMm, // validated end > start in domain
  fixed: z.boolean().default(false),
});
const TaskCreate = z.object({
  title: z.string().min(1).max(120),
  taskKind: TaskKind,
  dueOn: IsoDate.optional(),
  notes: z.string().max(1000).optional(),
});
const ObservationRecord = z.object({
  category: ObservationCategory,
  valueText: z.string().min(1).max(200), // the user's words
  valueNum: z.number().optional(), // only if the user stated a number
  occurredOn: IsoDate,
});

const Provenance = z.object({
  source: z.enum(["model", "parser", "user"]),
  model: z.string().optional(),
  promptVersion: z.string().optional(),
  harnessRunId: z.string().uuid().optional(),
  quote: z.string().min(1), // must be a substring of the capture
  confidence: z.enum(["low", "medium", "high"]),
});
const WarningCode = z.enum([
  "date_from_weekday",
  "date_is_today",
  "time_assumed_pm",
  "time_assumed_duration",
  "conflicts_with_fixed_block",
  "possible_duplicate_task",
  "low_confidence",
]);
// ProposalItem = { id, kind, payload (partial), status, missingSlots[], warnings[], provenance }
```

The model-facing schema (`submit_proposals`) is the same union with an array wrapper and `.max(20)`
items.

## Server actions (all `requireUser()`, zod-parsed input)

| Action                            | Input → Output                                                                                  | Writes                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `createCapture`                   | `{ text ≤ 2000 chars }` → `{ captureId }`                                                       | `captures`                                                                                           |
| `interpretCapture`                | `{ captureId }` → `{ items: ProposalItem[], interpretedBy: "model" \| "parser", droppedCount }` | `harness_runs` (metadata), `harness_run_payloads` only if `LTS_AI_TRACE_MODE=full`, `proposal_items` |
| `updateItem`                      | `{ itemId, patch }` → `ProposalItem` (re-normalized, re-validated, slots recomputed)            | `proposal_items`                                                                                     |
| `approveItems`                    | `{ itemIds[] }` → `{ applied[], failed[] }`                                                     | `proposal_items`; domain tables + `change_log` **via `runMutations`** (same transaction)             |
| `editBlock`, `deleteTask`, … (M5) | `{ id, patch }` → updated row                                                                   | domain tables + `change_log` via `runMutations` (`origin: manual`)                                   |
| `undoChange` (M5)                 | `{ mutationId }` → reverted rows                                                                | via `runMutations` (`origin: undo`)                                                                  |
| `rejectItems`                     | `{ itemIds[] }` → `{ rejected[] }`                                                              | `proposal_items`                                                                                     |
| `getToday` (server read)          | `{ date }` → `{ blocks, upcoming, openTasks, observations }`                                    | none                                                                                                 |

## AI tools used in the slice (M4)

| Tool                      | Purpose here                                                                       | Limits      |
| ------------------------- | ---------------------------------------------------------------------------------- | ----------- |
| `get_today`               | avoid proposing duplicates; detect conflicts                                       | one date    |
| `get_schedule`            | resolve "Saturday" conflicts with existing fixed blocks                            | ≤ 14 days   |
| `list_open_tasks`         | flag "need groceries" if already open                                              | ≤ 50 titles |
| `get_recent_observations` | not used for interpretation by default; only if the user opted in to that category | ≤ 14 days   |
| `submit_proposals`        | the only output                                                                    | ≤ 20 items  |

The model is reached through the Vercel AI Gateway adapter (`LTS_AI_PROVIDER=gateway`) or the
offline mock. The harness reads the model's `ProviderCapabilities`: without tool calling it
pre-fetches `get_today`/`list_open_tasks` into a single call instead of looping.

System prompt rules (versioned `interpret@1`): return only `submit_proposals`; one item per distinct
thing; copy the exact `quote`; never convert feelings into numbers or modes; leave unknown fields
empty instead of guessing; no medical or diagnostic language; nothing is saved until the user
approves.

## Screens

| Screen          | Content                                                                                                                                                                                                                                          | Empty / loading / error                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in         | Email field, "Send link", sent confirmation                                                                                                                                                                                                      | Invalid email inline; link expired → resend                                                                                                                                                                                              |
| Today           | Capture box; today's timeline (fixed blocks visually solid); Upcoming 7 days; Open tasks; "You said today" list                                                                                                                                  | Empty: "Nothing planned yet. Say what's going on." Loading: skeleton rows. Error: retry banner, capture box still usable                                                                                                                 |
| Proposal review | Source text once at top; groups; item cards with diff row, assumption chips, slot inputs; per-item Approve / Edit / Reject; sticky "Approve N ready"; provenance footer ("Interpreted by `<model>` · `interpret@1`" or "Interpreted without AI") | Loading: "Reading your note…" with cancel. Nothing found: "I couldn't turn that into changes. Save it as a task?" Provider failure: parser result + banner. Approval failure: items marked failed with a reason, nothing partially saved |

Mobile: single column; the approve bar sticks to the bottom; slot chips are full-width tap targets.
Desktop: review renders as two columns (items | source + provenance).

## Tests

- **Domain** (table-driven, pinned reference date + timezone): weekday/"next X"/today/tomorrow;
  the abbreviations `sat`/`mon` (the legacy bug); `2-7` with a work context → PM; `7am-8am` stays AM
  (the legacy bug); `end ≤ start` → slot; conflicts with fixed blocks; duplicate-task warning;
  observation grounding (the quote must be in the capture); safety denylist rejects diagnosis and
  medication text.
- **Contracts:** every kind round-trips; partial payloads compute the right missing slots.
- **Parser:** the legacy test prompts as golden fixtures.
- **Harness (scripted mock provider):** happy path; invalid JSON → one retry → parser fallback; tool
  call outside the allowlist rejected; tool args beyond limits rejected; more than 4 rounds stops;
  every path writes a `harness_runs` row; **no domain table changes after `interpretCapture`**.
- **Mutation layer (Postgres):** for both the proposal path and the manual path, each command is
  validated, authorized (a row of user A referenced by user B fails, it is not a silent no-op),
  written with `change_log` (actor, origin, before/after, `mutation_id`) and provenance; an injected
  failure rolls back the whole call. `approveItems` never writes domain tables except through
  `runMutations` (asserted with a spy). Rejected items write nothing.
- **Isolation:** user B cannot read, approve, or edit user A's rows through any repository function
  or tool. This is the tenancy mitigation, because the server connection bypasses RLS.
- **Traces:** in `metadata` mode no payload row is written; in `full` mode payloads expire and are
  pruned; provenance still resolves after pruning.
- **Risk stop:** the fixed phrase list blocks interpretation and shows the fixed message; ordinary
  "exhausted" or "stressed" captures do **not** trigger it.
- **E2E (Playwright, mock provider, M5):** sign in → capture the example → fill gym times → approve
  ready → approve the observation individually → Today shows Work on Sat, Exam Tue, Gym ×3,
  Groceries, and "You said: exhausted lately" → edit the Work block manually → History shows both
  origins → Undo reverts the manual edit.

## Success criteria

1. Zero AI-originated domain writes without approval, and zero domain writes outside the mutation
   layer. Asserted by tests at the harness, approval, and mutation layers plus the lint rule.
2. Every changed row traces to its origin in the UI: capture text, source, model/prompt version,
   and approval time for proposals; "edited by you" plus time for manual changes. This still works
   after raw AI payloads are pruned.
3. The worked example produces the table above with the mock provider. With the real provider,
   ≥ 90% field-level accuracy on 20 golden fixtures (`pnpm eval`).
4. A fully explicit capture ("dentist friday 3-4pm") goes from Enter to on-Today in ≤ 3 taps.
5. AI Gateway down or not configured → the slice still works via the parser, clearly labeled.
6. No item ever contains invented numbers for feelings, modes, diagnoses, or advice.
7. Usable at a 375 px width; all states above implemented.
8. CI green: lint, format, typecheck, unit, DB integration, e2e, build.

## Optional add-on: routine with recovery variants (M6)

- `routines` with `full` / `short` / `minimum` variants (from the legacy full/compressed/emergency
  versions). Logging the minimum counts as done.
- Today shows the next routine and its suggested variant. Suggestion rule (deterministic, cited): if
  the user approved an energy/sleep/stress observation today, or the routine was missed or partial
  2 of the last 3 times, suggest `short` or `minimum` with "because you said 'exhausted lately'" or
  "it's been a heavy week for this one". It is never a streak, score, or red badge.
- A miss offers three buttons: _Do minimum now_, _Move to later_, _Skip today, no penalty_.
- New proposal kind `routine_run.log` so captures like "did my morning routine, short version" work.
