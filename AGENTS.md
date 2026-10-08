# Agent guide for LTS

LTS (Life Tracker Suite) 1.0 turns messy real-life input into useful actions the user can govern.
The current architecture is the destination; the legacy app is the behavioral reference for restoring
useful product capability quickly. See `docs/LEGACY_PARITY.md`.

Read before changing anything. The constitution and ADRs win over this file and over your own
ideas; the others must agree with them:

- [`docs/STATUS.md`](docs/STATUS.md): where the project is right now and what comes next
- [`docs/PRODUCT_CONSTITUTION.md`](docs/PRODUCT_CONSTITUTION.md): product rules that settle
  arguments, including the dated amendments of 2026-10-08
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): boundaries, data model, mutation layer, AI
  harness, room modules and signals
- [`docs/DEVELOPMENT_PLAYBOOK.md`](docs/DEVELOPMENT_PLAYBOOK.md): workflow, tests, migrations, releases
- [`docs/adr/`](docs/adr/README.md): architecture decisions
- [`docs/planning/build-sequence.md`](docs/planning/build-sequence.md): milestones, each with its
  files, definition of done, tests, and "Do not build yet" list. The rest of `docs/planning/` is
  background (slice spec, hosting setup, legacy audit).

## Precedence and product-intent references

When documents disagree, the higher one wins and the lower one gets fixed:

1. `docs/PRODUCT_CONSTITUTION.md`, as amended
2. ADRs in `docs/adr/`
3. This file, and the working docs it indexes (`ARCHITECTURE.md`, `DEVELOPMENT_PLAYBOOK.md`,
   `UI.md`, `LEGACY_PARITY.md`, `MODULE_PARITY.md`, `STATUS.md`)
4. `docs/planning/`

Do not tell an agent, or write code, to violate the constitution. If a change needs one of its
rules to change, amend the constitution first, with an ADR.

For what Lucas actually used and intended, read [`docs/history/`](docs/history/) and
[`docs/MODULE_PARITY.md`](docs/MODULE_PARITY.md) before working on a room. They inform what to
build; they do not override the three levels above. The earlier design-plan decisions (kept outside
the repo; `docs/UI.md` is what the code does today) still apply wherever they do not conflict with
the amendments.

## Rules

- **Stack lock:** Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres + Auth),
  Drizzle, zod, Vitest, Vercel. Don't replace any of these, the proposal/mutation architecture, or
  the repo structure unless implementation produces concrete evidence that it is blocking (a failing
  test, a measured limit, an unmeetable requirement). That evidence opens an ADR.
- **Historical priority:** keep the behavior Lucas actually used, add the connections from the Life
  Tracker OS era, build both on the current engineering foundation. Where historical versions
  conflict, prefer functionality he used and valued unless there is a concrete technical or safety
  problem (Constitution, Amendment 1). Dense functionality, metrics and history are welcome where
  they serve use.
- **Product-first:** use the current milestone as a guide, not a reason to defer a high-value legacy
  capability. Check `docs/LEGACY_PARITY.md` and `docs/MODULE_PARITY.md` before substantial feature
  work. Reuse product behavior aggressively while keeping the current architecture. New ideas
  outside the parity target go to `docs/BACKLOG.md`; don't rewrite working code to taste.
- **Modularity:** working on a room should make it more independently removable. Extract each room
  you touch from `src/app/(life)/LifeWorkspace.tsx` into `src/modules/<room>/` (contracts, domain,
  signals, queries, mutations, components, tests; the shape is guidance, not mandatory). Signals are
  a typed derived view (`getHabitSignals`, `getTaskSignals`: functions that read data and return
  typed signals), not an event bus, pub/sub, or stored events. Vocabulary: `needs_time`,
  `needs_attention`, `needs_protection`, `needs_recovery`, `overdue`, `conflict`, `capacity_warning`,
  `upcoming_deadline`, `routine_candidate`, `review_candidate`. Schedule owns time, Today owns
  execution, Review owns governance, History owns the factual record, Archive owns inactive state,
  Settings owns constraints and permissions, NOVA interprets and acts only within configured
  authority, Capture owns messy input, Sandbox owns hypothetical state. Disabling a module hides it
  and stops its signals but keeps its data. A module never silently mutates another module's state.
  This is an addition to the stack lock, not a stack change ([ADR 0012](docs/adr/0012-room-modules-and-signals.md)).
- **Mutation layer:** every consequential domain write (schedule blocks, tasks, observations,
  profile settings, and later routines/inferences/reviews) goes through `runMutations` in
  `src/server/mutations/`: validate → authorize every row against `userId` → write → `change_log`
  (before/after, actor, origin) → provenance, all in one transaction. Only that folder may import
  repository write helpers (`*.writes.ts`); ESLint enforces it.
- **Authority:** explicit, low-risk commands may execute directly when they are on the allowlist and
  the user has granted that authority in Settings (the allowlist starts narrow: add a task, add a
  grocery item, log a clearly stated entry). Never directly execute health or sensitive data,
  deletions or archives, anything inferred or ambiguous, or bulk changes. Autonomous or interpretive
  suggestions and high-impact actions require confirmation. Every domain write, direct or confirmed,
  uses `runMutations`, is logged with provenance, shows in History, and is undoable; manual edits
  use `origin: manual`. Rejected proposals write nothing.
- **Tenancy:** repositories take `userId` first and filter by it. Every repository function and AI tool
  gets a cross-user isolation test (user B sees and changes nothing of user A's).
- **AI safety:** no diagnosis, condition names, or medication advice, and no medical or rehab advice;
  no identity or personality labels. Never convert words into numbers, never infer a score or a day
  mode from text. A number the user reports about their own state (mood, energy, stress, capacity)
  is allowed when it is labeled subjective and self-reported, and is never presented as objective
  truth or diagnosis. Targets such as TDEE, calories or bodyweight goals are the user's entered
  estimates; LTS does not prescribe intake. Observations quote the user, and inferences are separate
  from observations and never become them. Streaks are allowed only as factual continuity metrics
  with the semantics in Constitution Amendment 2: evaluate only due occurrences, "no entry" is not
  "missed", only an explicit miss breaks one, local date keys (never UTC
  `toISOString().slice(0, 10)`). No red miss badges, no guilt or shame copy. The risk-language stop
  is a narrow fixed phrase list (no AI call, fixed message pointing to human help, US 988). It is
  not a crisis classifier, and nothing may claim it is. AI tools are allowlisted and limited.

## Commands

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local   # Windows: copy .env.example .env.local
supabase start               # local Postgres + Auth + Mailpit (Docker)
pnpm db:migrate
pnpm db:seed                 # fictional user Sam (sam@example.com)
pnpm dev                     # http://localhost:4317
pnpm check                   # lint + format check + typecheck + unit tests
pnpm build
pnpm test:db                 # DB integration tests against local Postgres
```

`pnpm check`, `pnpm build`, and `pnpm test:db` must pass before every push. Schema changes:
edit `src/server/db/schema.ts`, run `pnpm db:generate`, and commit the schema and migration together.

## Repo hygiene

- pnpm **10.33.3** (`packageManager` in `package.json`). Commit `pnpm-lock.yaml` whenever
  dependencies change.
- LF line endings only (`.gitattributes`, `.editorconfig`). Prettier formats Markdown too.
- Git identity: `Lucas Caudle <lucascaudle5@gmail.com>`. No other email in commits or trailers.
- One feature branch per milestone (e.g. `m3-approval-loop`), small commits with imperative
  messages, then a PR to `main`. CI must be green before merge. Tag after merge (`v0.3.0`, …).
- Never commit secrets. Real values live only in `.env.local` and the Vercel/Supabase dashboards.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
