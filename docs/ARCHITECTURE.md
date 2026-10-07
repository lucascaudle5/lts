# LTS 1.0 Architecture

Status: accepted for v1. Changes need a demonstrated limitation (Constitution, Article 10) and an
ADR.

## Shape in one picture

```
Browser (React UI, no secrets, no table access)
   │  Server Actions / Route Handlers (zod-validated, requireUser())
   ▼
Next.js server ───────────────────────────────────────────────────────────────┐
   │                                                                         │
   ├─ compiler: capture text → AI harness or parser → ProposalItem[]         │
   │     └─ validate → resolve dates/times → grounding/safety → missing slots│
   ├─ approval: approved items → ONE Postgres transaction → domain rows      │
   │                                         + change_log rows               │
   ├─ AI harness: provider adapter + bounded read tools (no SQL, no writes)  │
   └─ repositories: the only code that touches the database (scoped by user)│
                                                                             │
Supabase: Postgres (data) + Auth (sessions) ◄────────────────────────────────┘
Model provider (OpenAI-compatible HTTP API, or offline mock) ◄── harness only
```

## Stack

| Concern    | Choice                                                                  | Why (ADR)                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App        | Next.js (App Router) + React + TypeScript, single package               | One deployable holds UI, server logic, and AI secrets ([0003](adr/0003-framework-nextjs-single-app.md), [0008](adr/0008-single-package-not-monorepo.md)) |
| UI         | Tailwind CSS + shadcn/ui                                                | Accessible primitives without a design-system project                                                                                                    |
| Database   | PostgreSQL on Supabase; schema + migrations with Drizzle                | Relational, transactional, free tier, local stack ([0004](adr/0004-postgres-on-supabase.md))                                                             |
| Auth       | Supabase Auth (email magic link), sessions via `@supabase/ssr`          | Comes with the database; no extra service                                                                                                                |
| Validation | zod schemas in `src/contracts` used by UI, server, and AI output        | One definition of every shape                                                                                                                            |
| AI         | Own harness; one OpenAI-compatible HTTP adapter + offline mock provider | Provider-independent, testable without a key ([0005](adr/0005-ai-tools-not-raw-db-access.md))                                                            |
| Dates      | `date-fns` + `@date-fns/tz`, user timezone stored in profile            | Fixes the legacy UTC/local split                                                                                                                         |
| Tests      | Vitest (unit + DB integration), Playwright (slice e2e)                  | Fast default, one real browser test of the loop                                                                                                          |
| Deploy     | Vercel (app) + Supabase hosted (db/auth)                                | Zero-ops for a solo student; both have free tiers                                                                                                        |

## Source layout and import boundaries

Directories appear when the milestone that needs them starts (see `README.md` for the current tree).

| Path              | Owns                                                                                                       | May import                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `src/contracts/`  | zod schemas + inferred types: proposal kinds, envelopes, tool I/O                                          | `zod` only                            |
| `src/domain/`     | Pure rules: date/time resolution, validation, missing slots, conflicts, routine variant choice             | `contracts`, `date-fns`               |
| `src/ai/`         | Harness loop, provider adapters, tool definitions, prompts, eval fixtures                                  | `contracts`, `domain`, `server/tools` |
| `src/server/`     | DB schema, repositories, approval transaction, auth helpers, tool implementations (`import "server-only"`) | everything except `app`, `components` |
| `src/app/`        | Routes, layouts, Server Actions (thin: parse input → call server → return)                                 | `server`, `contracts`, `components`   |
| `src/components/` | UI; `ui/` is shadcn primitives, the rest are LTS components                                                | `contracts` (types), `lib`            |
| `db/migrations/`  | Generated SQL migrations                                                                                   | —                                     |

`domain` and `contracts` stay pure (no I/O) so the compiler can be unit-tested exhaustively. An ESLint
`no-restricted-imports` rule enforces the table from M1 onward.

## Data ownership

- Every row has `user_id`. Repositories take `userId` as their first argument and always filter by it.
- The browser never queries tables. RLS is enabled on every table with **no** policies for the
  `anon`/`authenticated` roles, so the public Supabase key cannot read data even if misused. The
  server connects with `DATABASE_URL`.
- Only `src/server/approval/` writes domain tables on behalf of proposals. Direct user edits
  (Article 6) go through repository functions that also write `change_log`.
- Lucas owns the data: export (JSON of all user rows) lands before v1.0 (M8).

## Domain model (v1)

Created in M1 unless marked.

| Table                   | Purpose                                             | Key columns                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`              | Per-user settings                                   | `user_id` (= auth user id), `timezone`, `ai_sensitive_categories text[]`                                                                                                                                 |
| `captures`              | Raw input exactly as typed                          | `text`, `reference_date`, `timezone`, `created_at`                                                                                                                                                       |
| `harness_runs`          | Audit of each interpretation                        | `capture_id`, `provider`, `model`, `prompt_version`, `tool_calls jsonb`, `raw_output jsonb`, `validation_errors jsonb`, `status`, `latency_ms`                                                           |
| `proposal_items`        | Typed IR, one row per proposed change               | `capture_id`, `harness_run_id`, `kind`, `payload jsonb`, `original_payload jsonb`, `status`, `missing_slots jsonb`, `warnings jsonb`, `source`, `confidence`, `quote`, `decided_at`, `applied_entity_id` |
| `schedule_blocks`       | Time-bound commitments                              | `title`, `kind` (work/class/exam/fitness/meal/focus/personal), `starts_at`, `ends_at` (timestamptz), `fixed`, `origin_item_id`, `deleted_at`                                                             |
| `tasks`                 | Things to do, optionally dated                      | `title`, `kind` (errand/assignment/exam/chore/other), `due_on date`, `status` (open/done/parked), `notes`, `origin_item_id`                                                                              |
| `observations`          | What the user reported or logged                    | `category` (energy/sleep/stress/capacity/note), `value_text`, `value_num` (only if user gave a number), `occurred_on`, `source` (user_statement/manual_entry), `quote`, `sensitivity`, `origin_item_id`  |
| `change_log`            | Every consequential write                           | `entity_type`, `entity_id`, `action`, `before jsonb`, `after jsonb`, `actor` (user/automation), `proposal_item_id`                                                                                       |
| `routines` (M6)         | Recurring routines with variants                    | `name`, `anchor` (morning/evening/custom), `active`                                                                                                                                                      |
| `routine_variants` (M6) | `full` / `short` / `minimum` step lists             | `routine_id`, `variant`, `steps text[]`, `est_minutes`                                                                                                                                                   |
| `routine_runs` (M6)     | What happened                                       | `routine_id`, `variant_used`, `outcome` (done/partial/skipped), `on_date`                                                                                                                                |
| `inferences` (M7)       | Provisional conclusions, separate from observations | `claim`, `basis_observation_ids uuid[]`, `confidence`, `status` (proposed/accepted/rejected/expired), `expires_at`, `harness_run_id`                                                                     |
| `reviews` (M7)          | Saved weekly reviews                                | `period_start`, `period_end`, `body`, `cited_ids uuid[]`                                                                                                                                                 |

Deliberately absent from v1: projects, money, diet logs, fitness programming, connectors, frontier
tracking. The model leaves room for them: connectors will be a `links(from, to, relation)` table and
frontier/floor a `focus_areas` table, added when a milestone needs them.

## Contracts

`src/contracts/proposals.ts` (M1) defines a discriminated union on `kind`:

```ts
type ProposalKind =
  | "schedule_block.create" // { title, blockKind, date, start: "HH:MM", end: "HH:MM", fixed }
  | "task.create" // { title, taskKind, dueOn?: "YYYY-MM-DD", notes? }
  | "observation.record" // { category, valueText, valueNum?, occurredOn }
  | "schedule_block.update" // M5: { id, patch } — rendered as before/after diff
  | "task.update" // M5
  | "routine_run.log"; // M6: { routineId, variant, outcome, onDate }

interface ProposalItem<K extends ProposalKind> {
  id: string;
  kind: K;
  payload: Partial<PayloadFor<K>>; // partial until every required slot is filled
  status: "needs_input" | "ready" | "approved" | "rejected" | "applied" | "failed";
  missingSlots: { path: string; reason: string; options?: string[] }[];
  warnings: { code: WarningCode; message: string }[]; // e.g. "time_assumed_pm", "date_from_weekday", "conflicts_with_fixed_block"
  provenance: {
    source: "model" | "parser" | "user";
    model?: string;
    promptVersion?: string;
    harnessRunId?: string;
    quote: string; // exact span of capture text this came from
    confidence: "low" | "medium" | "high";
  };
}
```

Contracts are versioned by file (`proposals.v1.ts` re-exported as `proposals.ts`) only if a breaking
change is ever needed after v1 data exists.

## The compiler pipeline

Internal metaphor; the UI just says "Here's what I'd change."

1. **Capture** — store raw text with the user's reference date and timezone.
2. **Interpret** — AI harness (or the deterministic parser when AI is off/failing) returns candidate
   items. Simple, fully explicit inputs ("dentist friday 3-4pm") can skip the model entirely.
3. **Schema validation** — zod parse; invalid items are dropped and recorded in
   `harness_runs.validation_errors`, never shown half-parsed.
4. **Normalization** — deterministic resolution of weekday words, "next X", times, and am/pm from the
   item's `quote`. When the quote is explicit, the deterministic value overrides the model's.
5. **Grounding and safety** — `quote` must be a substring of the capture; `observation.record` must
   quote the user's own words; no item may contain diagnosis or medication language (deterministic
   denylist + prompt rule); interpretations are never typed as observations.
6. **Business validation** — `end > start`, dates in range, conflicts with existing fixed blocks,
   duplicates of open tasks → warnings or missing slots.
7. **Missing slots** — required fields still empty become slots the UI renders as chips/inputs.
   Status is `ready` only when no slots remain.
8. **Approval** — user approves, edits, or rejects per item (or "approve all ready").
9. **Transaction** — see below. Today re-renders from the database, not from the proposal.

## AI harness

```
interpret(capture) →
  context = deterministic snapshot (date, timezone, today's blocks, open tasks count)
  loop ≤ 4 rounds:
    provider.generate(system prompt vN, messages, tools = allowlist for "interpret")
    run requested read tools (validated args, row/time limits, sensitivity gate)
  final answer must be submit_proposals({ items }) → pipeline steps 3–7
  on provider error / 2× invalid output → deterministic parser, provenance.source = "parser"
  persist harness_runs row (always, including failures)
```

- **Provider interface** (`src/ai/provider.ts`): `generate({ system, messages, tools, output }) →
{ toolCalls } | { output }`. Adapters: `openai-compatible` (any `/chat/completions` endpoint —
  Groq, OpenAI, OpenRouter, Ollama — selected by `LTS_AI_BASE_URL`) and `mock` (deterministic;
  default in dev and CI). Adding a provider never touches the harness.
- **Tools are LTS functions, not database access** ([ADR 0005](adr/0005-ai-tools-not-raw-db-access.md)).
  Each tool has a zod input schema, a server implementation scoped to the current user, row limits,
  and a sensitivity tag.

| Tool (v1)                 | Kind   | Limits                                         | Milestone |
| ------------------------- | ------ | ---------------------------------------------- | --------- |
| `get_today`               | read   | one date                                       | M4        |
| `get_schedule`            | read   | ≤ 14-day window                                | M4        |
| `list_open_tasks`         | read   | ≤ 50 rows, titles + due dates only             | M4        |
| `get_recent_observations` | read   | ≤ 14 days; only categories the user opted into | M4        |
| `submit_proposals`        | output | the only way the model returns changes         | M4        |
| `get_recent_routines`     | read   | ≤ 14 days of runs                              | M6        |
| `search_history`          | read   | ≤ 20 results, cited ids                        | M7        |
| `propose_inference`       | output | needs ≥ 1 cited observation id                 | M7        |
| `create_review`           | output | draft only; user saves                         | M7        |

Brief tools not in v1 (`get_active_projects`, `get_active_frontier`, `propose_routine_change`,
connectors) stay in the backlog until their domain tables exist.

- **Prompts** live in `src/ai/prompts/` as TypeScript constants with a `PROMPT_VERSION`; the version is
  stored on every `harness_runs` row.
- **Evals**: `src/ai/fixtures/*.json` hold golden captures (including the legacy test prompts) with a
  fixed reference date and expected items. CI runs them against the mock provider and the parser;
  `pnpm eval` runs them against the configured real provider on demand.

## Approval flow and state changes

`approveItems(userId, itemIds, edits)` in `src/server/approval/`:

1. Load items `FOR UPDATE`; reject unless every item is `ready` (after applying user edits and
   re-running steps 4–7 on the edited payload).
2. In **one transaction**: insert/update domain rows, insert `change_log` rows (`before`, `after`,
   `proposal_item_id`, `actor = "user"`), set items to `applied` with `applied_entity_id`.
3. Any failure rolls back everything; items become `failed` with the error in `warnings`.
4. Rejections set `rejected` + `decided_at` and write nothing else.

Edits keep `original_payload` so the diff between model output and what the user approved is
measurable (it is the best eval signal LTS will have). Undo (M5) creates the inverse change through
the same function, so it is logged like any other change.

## Provenance

Every domain row created from a proposal points to `origin_item_id` → `proposal_items` →
`harness_runs` + `captures`. The UI can always answer "where did this come from?" with the
original quote, the source (model / parser / user), the model id, and when it was approved.

## Auth

- Supabase Auth email magic link; local dev uses the Supabase CLI's mail catcher.
- Next.js proxy refreshes the session; `requireUser()` in every Server Action and Route Handler.
- First sign-in creates the `profiles` row with the browser's timezone.

## Frontend

| Route            | Screen                                                                             | Milestone |
| ---------------- | ---------------------------------------------------------------------------------- | --------- |
| `/sign-in`       | Email field → magic link                                                           | M2        |
| `/today`         | Capture box on top; today's blocks (timeline), due/open tasks, latest self-reports | M2–M3     |
| `/captures/[id]` | Proposal review: grouped items, slots as chips, diff, approve/edit/reject          | M3        |
| `/history`       | Change log with provenance and Undo                                                | M5        |
| `/routines`      | Routines with full/short/minimum variants; log a run                               | M6        |
| `/review`        | Weekly review draft citing observations                                            | M7        |

Mobile-first; every screen has empty, loading, and error states. Server Components for reads,
Server Actions for writes.

## Testing

| Layer            | Tool              | What                                                                                             |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| contracts/domain | Vitest            | Date resolution table tests, validation, slots, conflicts, safety denylist                       |
| ai               | Vitest            | Harness loop with scripted mock provider: tool limits, invalid output, fallback; golden fixtures |
| server           | Vitest + Postgres | Approval transaction (atomicity, rollback, change_log), cross-user isolation                     |
| slice            | Playwright        | sign in → capture → approve → Today shows it (mock provider)                                     |

CI runs lint, format check, typecheck, unit tests, and build from M0; DB integration tests join in
M1 (Postgres service container); Playwright joins in M5.

## Deployment

- Vercel project linked to the GitHub repo; preview deploys per PR, production from `main`.
- Supabase project; migrations applied with `pnpm db:migrate` against the production
  `DATABASE_URL` before promoting a release.
- Post-deploy check: `/api/health` returns version + DB reachability (M2); manual smoke of the slice.

## What came from the legacy build

The v2.9.7 static build (see `LEGACY.md`) contributed concepts, not code:

- approval-before-write and grouped import preview → the approval flow above;
- `commandPreviewNeedsConfirmation` reasons ("date came from words", "AM/PM assumption") → typed
  `warnings` codes;
- Worker `normalizeParsed` overriding model dates/times with explicit values from the source line →
  pipeline step 4;
- `lts-import-v1` item kinds (schedule, assignment, mind, mealBlock, capture) → v1 proposal kinds,
  with "mind" split into user-quoted observations;
- full/compressed/emergency routine versions and habit "minimum version counts" → M6 variants;
- import batches with `sourceText` → `captures` + provenance;
- legacy test prompts → golden eval fixtures.

Dropped on purpose: localStorage as the source of truth, 49 version-key migrations, string-HTML
rendering, free-text-matching decision application, season/day-mode personality taxonomies, and the
stabilization percentage score.
