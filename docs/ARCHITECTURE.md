# LTS 1.0 Architecture

Status: accepted for v1. Changes need a demonstrated limitation (Constitution, Article 10) and an
ADR. From M1 on, the stack-lock rule in `DEVELOPMENT_PLAYBOOK.md` applies.

**Core invariant:** all consequential domain mutations go through the same audited mutation layer.
An authority check routes explicit low-risk commands the user has allowed to a direct mutation;
interpretive or high-impact actions remain proposals that require confirmation.

## Shape in one picture

```
Browser (React UI, no secrets, no table access)
   │  Server Actions / Route Handlers (zod-validated, requireUser())
   ▼
Next.js server ─────────────────────────────────────────────────────────────────┐
   │                                                                           │
   ├─ compiler: capture text → AI harness or parser → typed candidate actions
   │     └─ validate → normalize → grounding/safety → authority and risk check
   ├─ confirmation: interpretive/high-impact proposals ─┐
   ├─ allowed explicit low-risk commands ───────────────┤
   ├─ manual edits and undo ────────────────────────────┤
   │                                                   ▼
   ├─ mutation layer: validate → authorize → write → change_log → provenance   │
   │                  all inside ONE Postgres transaction                      │
   ├─ AI harness: gateway adapter + bounded read tools (no SQL, no writes)     │
   └─ repositories: reads, plus write helpers only the mutation layer may call │
                                                                               │
Supabase: Postgres (data) + Auth (sessions) ◄──────────────────────────────────┘
Vercel AI Gateway (or offline mock) ◄── harness only
```

## Stack

| Concern    | Choice                                                                      | Why (ADR)                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App        | Next.js (App Router) + React + TypeScript, single package                   | One deployable holds UI, server logic, and AI secrets ([0003](adr/0003-framework-nextjs-single-app.md), [0008](adr/0008-single-package-not-monorepo.md)) |
| UI         | Tailwind CSS + shadcn/ui                                                    | Accessible primitives without a design-system project                                                                                                    |
| Database   | PostgreSQL on Supabase; schema + migrations with Drizzle                    | Relational, transactional, free tier, local stack ([0004](adr/0004-postgres-on-supabase.md))                                                             |
| Auth       | Supabase Auth (email + password), sessions via `@supabase/ssr`              | Routine sign-in does not depend on email delivery; see ADR 0009                                                                                          |
| Validation | zod schemas in `src/contracts` used by UI, server, and AI output            | One definition of every shape                                                                                                                            |
| AI         | Own harness; one Vercel AI Gateway adapter (AI SDK) + offline mock provider | One key/OIDC for many models, provider-independent, testable without a key ([0005](adr/0005-ai-tools-not-raw-db-access.md))                              |
| Dates      | `date-fns` + `@date-fns/tz`, user timezone stored in profile                | Fixes the legacy UTC/local split                                                                                                                         |
| Tests      | Vitest (unit + DB integration), Playwright (slice e2e)                      | Fast default, one real browser test of the loop                                                                                                          |
| Deploy     | Vercel (app) + Supabase hosted (db/auth), linked via the Vercel Marketplace | Zero-ops for a solo student; env vars wired automatically; free tiers                                                                                    |

## Source layout and import boundaries

Directories appear when the milestone that needs them starts (see `README.md` for the current tree).

| Path                    | Owns                                                                                                  | May import                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `src/contracts/`        | zod schemas + inferred types: domain commands, proposal envelopes, tool I/O, provider capabilities    | `zod` only                                   |
| `src/domain/`           | Pure rules: date/time resolution, validation, missing slots, conflicts, safety stop, routine variants | `contracts`, `date-fns`                      |
| `src/ai/`               | Harness loop, provider adapters, tool definitions, prompts, eval fixtures                             | `contracts`, `domain`, `server/tools`        |
| `src/server/mutations/` | The domain mutation layer (`runMutations`) — the only caller of repository write helpers              | `contracts`, `domain`, `server/repositories` |
| `src/server/`           | DB schema, repositories, approval, auth helpers, tool implementations (`import "server-only"`)        | everything except `app`, `components`        |
| `src/app/`              | Routes, layouts, Server Actions (thin: parse input → call server → return)                            | `server`, `contracts`, `components`          |
| `src/components/`       | UI; `ui/` is shadcn primitives, the rest are LTS components                                           | `contracts` (types), `lib`                   |
| `db/migrations/`        | Generated SQL migrations                                                                              | —                                            |

`domain` and `contracts` stay pure (no I/O) so the compiler can be unit-tested exhaustively. ESLint
`no-restricted-imports` enforces the table from M1 onward, including "only `src/server/mutations/**`
may import repository write helpers". Write helpers live in files named `*.writes.ts` (or
`writes.ts`) under `src/server/repositories/`; that name is how the rule recognizes them.

## Data ownership and tenancy

- Every row has `user_id`. Repositories take `userId` as their first argument and filter by it.
- The browser never queries tables. RLS is enabled on every table with **no** policies for the
  `anon`/`authenticated` roles, so the public (publishable) Supabase key cannot read data.
- **LTS is multi-tenant-conscious, not multi-tenant-safe by construction.** The server connects with
  a privileged Postgres connection (`POSTGRES_URL`), which bypasses RLS. A repository query that
  forgets its `user_id` filter would return another user's rows. The mitigations are: `userId` as a
  required first parameter, the mutation layer's authorization step, code review, and cross-user
  isolation integration tests for every repository function and every tool. Those tests reduce the
  risk; they do not guarantee isolation. In practice LTS has one user, which limits the blast radius
  but is not a control.
- Lucas owns the data: export (JSON of all user rows) lands before v1.0 (M8).

## Domain model (v1)

Created in M1 unless marked. "Domain tables" (written only through the mutation layer) are
`schedule_blocks`, `tasks`, `observations`, `routines*`, `routine_runs`, `inferences`, `reviews`, and
the settings columns of `profiles`. Pipeline bookkeeping (`captures`, `proposal_items` status,
`harness_runs*`) is written by its own module and is not a domain mutation.

| Table                   | Purpose                                             | Key columns                                                                                                                                                                                                                                                                 |
| ----------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`              | Per-user settings                                   | `user_id` (= auth user id), `timezone`, `ai_sensitive_categories text[]`                                                                                                                                                                                                    |
| `captures`              | Raw input exactly as typed (user data)              | `text`, `reference_date`, `timezone`, `safety_stop bool`, `created_at`                                                                                                                                                                                                      |
| `harness_runs`          | Durable, minimal AI trace (never pruned)            | `capture_id`, `provider`, `model`, `prompt_version`, `prompt_sha256`, `output_sha256`, `tool_calls jsonb` (names, validated args, row counts, returned ids), `proposal_item_ids uuid[]`, `validation_error_codes text[]`, `status`, `latency_ms`, `tokens_in`, `tokens_out` |
| `harness_run_payloads`  | Raw prompt/output text (prunable)                   | `harness_run_id`, `raw_prompt text`, `raw_output text`, `expires_at`                                                                                                                                                                                                        |
| `proposal_items`        | Typed IR, one row per proposed change               | `capture_id`, `harness_run_id`, `kind`, `payload jsonb`, `original_payload jsonb`, `status`, `missing_slots jsonb`, `warnings jsonb`, `source`, `confidence`, `quote`, `decided_at`, `applied_entity_id`                                                                    |
| `schedule_blocks`       | Time-bound commitments                              | `title`, `kind` (work/class/exam/fitness/meal/focus/personal), `starts_at`, `ends_at` (timestamptz), `fixed`, `origin` (manual/proposal), `origin_item_id`, `deleted_at`                                                                                                    |
| `tasks`                 | Things to do, optionally dated                      | `title`, `kind` (errand/assignment/exam/chore/other), `due_on date`, `priority` (low/medium/high), `status` (open/done/parked), `notes`, `origin`, `origin_item_id`                                                                                                         |
| `observations`          | What the user reported or logged                    | `category` (energy/sleep/stress/capacity/note), `value_text`, `value_num` (only if user gave a number), `occurred_on`, `source` (user_statement/manual_entry), `quote`, `sensitivity`, `origin_item_id`                                                                     |
| `change_log`            | Every consequential write                           | `mutation_id` (groups one transaction), `entity_type`, `entity_id`, `action`, `before jsonb`, `after jsonb`, `actor` (user/automation), `origin` (manual/proposal/undo), `proposal_item_id`                                                                                 |
| `routines` (M6)         | Recurring routines with variants                    | `name`, `anchor` (morning/evening/custom), `active`                                                                                                                                                                                                                         |
| `routine_variants` (M6) | `full` / `short` / `minimum` step lists             | `routine_id`, `variant`, `steps text[]`, `est_minutes`                                                                                                                                                                                                                      |
| `routine_runs` (M6)     | What happened                                       | `routine_id`, `variant_used`, `outcome` (done/partial/skipped), `on_date`                                                                                                                                                                                                   |
| `inferences` (M7)       | Provisional conclusions, separate from observations | `claim`, `basis_observation_ids uuid[]`, `confidence`, `status` (proposed/accepted/rejected/expired), `expires_at`, `harness_run_id`                                                                                                                                        |
| `reviews` (M7)          | Saved weekly reviews                                | `period_start`, `period_end`, `body`, `cited_ids uuid[]`                                                                                                                                                                                                                    |

Not yet modeled in the current schema: projects, money, diet logs, fitness programming, connectors,
and frontier tracking. The parity roadmap adds practical domains when their sprint arrives; avoid
collecting fields before a screen, review, or action needs them.

## Contracts

`src/contracts/commands.ts` defines the **domain commands** — the only shapes the mutation layer
accepts. Proposals use a subset; manual and authorized direct commands can also update an existing
row without creating an approval card:

```ts
type CommandKind =
  | "schedule_block.create" // { title, blockKind, date, start: "HH:MM", end: "HH:MM", fixed }
  | "task.create" // { title, taskKind, dueOn?: "YYYY-MM-DD", notes? }
  | "task.update" // { taskId, title?, taskKind?, dueOn?, priority?, status?, notes? }
  | "observation.record" // { category, valueText, valueNum?, occurredOn }
  | "schedule_block.update" // M5: { id, patch } — rendered as before/after diff
  | "schedule_block.delete" // M5 (manual only in v1)
  | "routine_run.log"; // M6: { routineId, variant, outcome, onDate }

interface ProposalItem<K extends CommandKind> {
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

Contracts are versioned by file (`commands.v1.ts` re-exported as `commands.ts`) only if a breaking
change is ever needed after v1 data exists.

## The compiler pipeline

Internal metaphor; the UI just says "Here's what I'd change."

0. **Safety stop** — see "Risk-language stop" below. On a match, nothing else runs.
1. **Capture** — store raw text with the user's reference date and timezone.
2. **Interpret** — AI harness (or the deterministic parser when AI is off/failing) returns candidate
   items. Simple, fully explicit inputs ("dentist friday 3-4pm") can skip the model entirely.
3. **Schema validation** — zod parse; invalid items are dropped and their error codes recorded on the
   `harness_runs` row, never shown half-parsed.
4. **Normalization** — deterministic resolution of weekday words, "next X", times, and am/pm from the
   item's `quote`. When the quote is explicit, the deterministic value overrides the model's.
5. **Grounding and safety** — `quote` must be a substring of the capture; `observation.record` must
   quote the user's own words; no item may contain diagnosis or medication language (deterministic
   denylist + prompt rule); interpretations are never typed as observations.
6. **Business validation** — `end > start`, dates in range, conflicts with existing fixed blocks,
   duplicates of open tasks → warnings or missing slots.
7. **Missing slots** — required fields still empty become slots the UI renders as chips/inputs.
   Status is `ready` only when no slots remain.
8. **Authority and risk** — explicit low-risk commands may execute directly only when the user's
   setting allows them. Interpretive suggestions, sensitive changes, and high-impact actions remain
   proposals for confirmation.
9. **Mutation** — direct commands and confirmed proposals become typed commands and run through the
   mutation layer (below). Today re-renders from the database, not from an uncommitted proposal.

## Domain mutation layer

`runMutations(ctx, commands)` in `src/server/mutations/` is the single gateway for consequential
writes. Two paths use it:

| Path            | Caller                                                  | `ctx`                                                            | Extra requirement                  |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| AI / parser     | `approveItems` (after the user approves proposal items) | `{ userId, actor: "user", origin: "proposal", proposalItemIds }` | Items must be `ready` and approved |
| Manual (Art. 6) | Server Actions for direct create/edit/delete, Undo (M5) | `{ userId, actor: "user", origin: "manual" \| "undo" }`          | None beyond the layer's own checks |
| Automation      | Only a deliberately configured automation (none in v1)  | `{ userId, actor: "automation", automationId }`                  | Automation enabled by the user     |

For every call, inside **one Postgres transaction**:

1. **Validate** — zod-parse each command; run the same domain rules (steps 4–6) on the final payload.
2. **Authorize** — every referenced row (`id` in updates/deletes, `routineId`, …) is loaded with
   `user_id = ctx.userId … FOR UPDATE`; a missing row is a failure, never a silent no-op.
3. **Write** — call repository write helpers (the only place they are called).
4. **Change log** — one `change_log` row per entity with `before`, `after`, `actor`, `origin`,
   `proposal_item_id`, sharing one `mutation_id`.
5. **Provenance** — set `origin` / `origin_item_id` on created rows.
6. **Atomicity** — any failure rolls back the whole call; the caller gets a typed error per command.

`approveItems(userId, itemIds, edits)` (in `src/server/approval/`) therefore never writes domain
tables itself. It locks the items, re-checks they are `ready` after edits, maps them to commands, calls
`runMutations` in the same transaction, then marks the items `applied` (or `failed`). Rejections only
update `proposal_items`. Undo (M5) builds the inverse command from `change_log.before` and runs it
through the same layer with `origin: "undo"`, so it is logged like any other change.

Edits keep `original_payload` so the diff between model output and what the user approved is
measurable (it is the best eval signal LTS will have).

## AI harness

```
interpret(capture) →
  context = deterministic snapshot (date, timezone, today's blocks, open tasks count)
  caps = provider.capabilities(model)
  if caps.toolCalling: loop ≤ 4 rounds of provider.generate(..., tools = allowlist) + read tools
  else:                single call with the snapshot pre-fetched into the prompt
  final answer is a bounded typed action → authority/risk check → direct allowed mutation or
    submit_proposals({ items }) for confirmation
  on provider error / 2× invalid output → deterministic parser, provenance.source = "parser"
  persist harness_runs row (always, including failures); payload row only if trace mode = full
```

### Provider and capabilities

- **Interface** (`src/ai/provider.ts`): `generate({ system, messages, tools, output }) →
{ toolCalls } | { output }` plus `capabilities(model): ProviderCapabilities`.
- **Adapters:**
  - `gateway` — Vercel AI Gateway through the AI SDK (`ai` package), model ids in
    `creator/model` form (`LTS_AI_MODEL`). Auth: `AI_GATEWAY_API_KEY` in local development;
    on Vercel deployments the project's OIDC token (`VERCEL_OIDC_TOKEN`) is used automatically when
    no API key is set (an explicit key takes precedence). Locally, `vercel env pull` can also provide
    an OIDC token, but it expires after 12 hours, so an API key is simpler for development.
  - `mock` — deterministic, offline; default in dev, tests, and CI.
- **Capability descriptor** (a type and a static table, not a capability system):

```ts
interface ProviderCapabilities {
  toolCalling: boolean; // false → harness pre-fetches context, single call
  structuredOutput: boolean; // false → ask for JSON in text; zod still validates
  maxContextTokens: number; // harness trims the context snapshot to fit
  streaming: boolean; // unused in v1; recorded so UI never assumes it
}
```

The gateway adapter declares capabilities for the few models LTS is configured to use; unknown
models get the most conservative descriptor (`false`, `false`, 8 000, `false`). Business logic
reads capabilities; it never branches on provider or model names.

### Tools

**Tools are LTS functions, not database access** ([ADR 0005](adr/0005-ai-tools-not-raw-db-access.md)).
Each tool has a zod input schema, a server implementation scoped to the current user, row limits,
and a sensitivity tag.

| Tool (v1)                 | Kind   | Limits                                         | Milestone |
| ------------------------- | ------ | ---------------------------------------------- | --------- |
| `get_today`               | read   | one date                                       | M4        |
| `get_schedule`            | read   | ≤ 14-day window                                | M4        |
| `list_open_tasks`         | read   | ≤ 50 rows, titles + due dates only             | M4        |
| `get_recent_observations` | read   | ≤ 14 days; only categories the user opted into | M4        |
| `submit_proposals`        | output | returns changes that need user confirmation    | M4        |
| `get_recent_routines`     | read   | ≤ 14 days of runs                              | M6        |
| `search_history`          | read   | ≤ 20 results, cited ids                        | M7        |
| `propose_inference`       | output | needs ≥ 1 cited observation id                 | M7        |
| `create_review`           | output | draft only; user saves                         | M7        |

Brief tools not in v1 (`get_active_projects`, `get_active_frontier`, `propose_routine_change`,
connectors) stay in the backlog until their domain tables exist.

### AI trace privacy and retention

Rule: **store the minimum AI trace required for provenance and debugging.** Raw prompts and model
output have a defined retention and can be disabled or pruned; everything provenance depends on
survives pruning.

| Kept on `harness_runs` (durable)                                                                                                                                                                                                    | Kept on `harness_run_payloads` (prunable)                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| provider, model, `prompt_version`, SHA-256 of the rendered prompt and of the raw output, tool names + validated args + row counts + returned entity ids, `proposal_item_ids`, validation error codes, status, latency, token counts | the rendered prompt text (includes the capture and tool results), the raw model output |

- `LTS_AI_TRACE_MODE=metadata` (default, and the production setting) writes no payload rows.
  `full` writes them with `expires_at = now() + LTS_AI_TRACE_RETENTION_DAYS` (default 7).
- Expired payload rows are deleted at the start of each harness call and by `pnpm ai:prune`; no
  scheduler needed. Deleting a capture deletes its payload rows.
- Provenance never depends on payloads: the user-visible chain is domain row → `proposal_items`
  (`quote`, `original_payload`) → `harness_runs` metadata → `captures`.
- Hashes let a debugging session confirm "this is the same prompt/output" without keeping the text.
- The AI Gateway keeps its own request logs (model, tokens, cost, status); check its data and
  retention settings in the Vercel dashboard — LTS's rule governs only LTS's database.

### Prompts and evals

- **Prompts** live in `src/ai/prompts/` as TypeScript constants with a `PROMPT_VERSION`; the version is
  stored on every `harness_runs` row.
- **Evals**: `src/ai/fixtures/*.json` hold golden captures (including the legacy test prompts) with a
  fixed reference date and expected items. CI runs them against the mock provider and the parser;
  `pnpm eval` runs them against the configured gateway model on demand.

## Risk-language stop

Deliberately narrow and conservative. Before interpretation, a small fixed list of explicit phrases
(self-harm or harm-to-others wording) is checked deterministically against the capture. On a match:
no AI call, no proposals, the capture is kept with `safety_stop = true`, and a fixed message is shown
that points to human help (in the US: call or text 988; otherwise local emergency services) with a
button to continue to Today.

This is **not a crisis classifier**. It does not score or infer risk, does not use a model, does not
notify anyone, and will miss most indirect language. It exists so LTS never answers explicit harm
language with a productivity proposal. Changing the phrase list or message requires a PR that says
why.

## Provenance

Every domain row records `origin` (`manual` / `proposal` / `undo`). Rows created from a proposal
point to `origin_item_id` → `proposal_items` → `harness_runs` + `captures`. The UI can always answer
"where did this come from?" with the original quote, the source (model / parser / user / manual),
the model id, and when it was approved.

## Auth

- Supabase Auth email and password; routine sign-in sends no email. Password reset links are sent
  only when the user explicitly requests account recovery. Local development can receive those
  recovery emails in the Supabase CLI's mail catcher.
- Next.js proxy (`src/proxy.ts`) refreshes the session and sends signed-out requests to `/sign-in`
  (default deny; only `/sign-in`, `/auth/*`, and `/api/health` are public). `requireUser()` in every
  protected page, Server Action, and Route Handler verifies the session again.
- First sign-in creates the `profiles` row with the browser's timezone (UTC if missing) and never
  overwrites an existing one. This bootstrap is account provisioning and writes directly; later
  changes to profile settings go through the mutation layer like any domain write.
- Password reset returns through `/auth/confirm` using Supabase's PKCE exchange. Add the production
  URL and any preview URLs to Supabase's redirect allow-list.

## Frontend

| Route            | Screen                                                                             | Milestone |
| ---------------- | ---------------------------------------------------------------------------------- | --------- |
| `/sign-in`       | Email and password form                                                            | M2        |
| `/today`         | Capture box on top; today's blocks (timeline), due/open tasks, latest self-reports | M2–M3     |
| `/captures/[id]` | Proposal review: grouped items, slots as chips, diff, approve/edit/reject          | M3        |
| `/history`       | Change log with provenance and Undo                                                | M5        |
| `/routines`      | Routines with full/short/minimum variants; log a run                               | M6        |
| `/review`        | Weekly review draft citing observations                                            | M7        |

Mobile-first; every screen has empty, loading, and error states. Server Components for reads,
Server Actions for writes.

## Testing

| Layer            | Tool              | What                                                                                                                                                                                                     |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| contracts/domain | Vitest            | Date resolution table tests, validation, slots, conflicts, safety denylist, risk-stop phrase list                                                                                                        |
| ai               | Vitest            | Harness loop with scripted mock provider: tool limits, invalid output, fallback, capability branches, trace modes; golden fixtures                                                                       |
| server           | Vitest + Postgres | Mutation layer (validation, authorization, atomicity, rollback, change_log, provenance) for both manual and proposal paths; cross-user isolation for every repository function and tool; payload pruning |
| slice            | Playwright        | sign in → capture → approve → Today shows it → manual edit → undo (mock provider)                                                                                                                        |

CI runs lint, format check, typecheck, unit tests, and build from M0; DB integration tests join in
M1 (Postgres service container); Playwright joins in M5.

## Deployment

- Vercel project linked to the GitHub repo; preview deploys per PR, production from `main`. Function
  region defaults to `iad1` (Washington, D.C.); the Supabase project lives in the closest AWS region
  (`us-east-1`).
- Supabase created through the Vercel Marketplace integration, which syncs `POSTGRES_URL`,
  `POSTGRES_URL_NON_POOLING`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (among others) into the Vercel project.
- Runtime uses the pooled `POSTGRES_URL` (transaction mode) with prepared statements off and a pool
  of 1 per function instance. Migrations use `POSTGRES_URL_NON_POOLING` via `pnpm db:migrate` before
  promoting a release.
- AI Gateway auth on Vercel is OIDC; no model key is stored in Vercel env vars.
- Post-deploy check: `/api/health` returns version + DB reachability (M2); manual smoke of the slice.
- Step-by-step guide: the playbook's "Hosting setup" section.

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
- `features/schedule.js` "write the DB before in-memory state, filter by `user_id`" → the mutation
  layer's authorize-then-write order;
- legacy test prompts → golden eval fixtures.

Dropped on purpose: localStorage as the source of truth, 49 version-key migrations, string-HTML
rendering, free-text-matching decision application, season/day-mode personality taxonomies, and the
stabilization percentage score.

## Complete workspace candidate

See ADR 0010 and LEGACY_PARITY.md. Supplemental domains use typed life_records; existing tasks,
schedule and observations stay in their original tables. Workspace operations, imports and manual
overrides enter runMutations. A per-user advisory transaction lock serializes daily log upserts and
recurring bill payments. Archived records stay in exports/History and are excluded from operational
views and bounded AI tools. The `(life)/[room]` route hosts additional rooms. Review uses deterministic
evidence and user decisions, not model-derived mental-state inferences.
