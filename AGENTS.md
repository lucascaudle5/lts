# Agent guide for LTS

LTS (Life Tracker Suite) 1.0 turns messy real-life input into useful actions the user can govern.
The current architecture is the destination; the legacy app is the behavioral reference for restoring
useful product capability quickly. See `docs/LEGACY_PARITY.md`.

Read before changing anything. These docs win over this file and over your own ideas:

- [`docs/STATUS.md`](docs/STATUS.md): where the project is right now and what comes next
- [`docs/PRODUCT_CONSTITUTION.md`](docs/PRODUCT_CONSTITUTION.md): product rules that settle arguments
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): boundaries, data model, mutation layer, AI harness
- [`docs/DEVELOPMENT_PLAYBOOK.md`](docs/DEVELOPMENT_PLAYBOOK.md): workflow, tests, migrations, releases
- [`docs/adr/`](docs/adr/README.md): architecture decisions
- [`docs/planning/build-sequence.md`](docs/planning/build-sequence.md): milestones, each with its
  files, definition of done, tests, and "Do not build yet" list. The rest of `docs/planning/` is
  background (slice spec, hosting setup, legacy audit).

## Rules

- **Stack lock:** Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres + Auth),
  Drizzle, zod, Vitest, Vercel. Don't replace any of these, the proposal/mutation architecture, or
  the repo structure unless implementation produces concrete evidence that it is blocking (a failing
  test, a measured limit, an unmeetable requirement). That evidence opens an ADR.
- **Product-first:** use the current milestone as a guide, not a reason to defer a high-value legacy
  capability. Check `docs/LEGACY_PARITY.md` before substantial feature work. Reuse product behavior
  aggressively while keeping the current architecture. New ideas outside the parity target go to
  `docs/BACKLOG.md`; don't rewrite working code to taste.
- **Mutation layer:** every consequential domain write (schedule blocks, tasks, observations,
  profile settings, and later routines/inferences/reviews) goes through `runMutations` in
  `src/server/mutations/`: validate → authorize every row against `userId` → write → `change_log`
  (before/after, actor, origin) → provenance, all in one transaction. Only that folder may import
  repository write helpers (`*.writes.ts`); ESLint enforces it.
- **Authority:** explicit, low-risk commands may execute directly when the user's permission setting
  allows it. Autonomous or interpretive suggestions and high-impact actions require confirmation.
  Every domain write, direct or confirmed, uses `runMutations`; manual edits use `origin: manual`.
  Rejected proposals write nothing.
- **Tenancy:** repositories take `userId` first and filter by it. Every repository function and AI tool
  gets a cross-user isolation test (user B sees and changes nothing of user A's).
- **AI safety:** no diagnosis, condition names, or medication advice; no identity or personality
  labels; never turn feelings into numbers, scores, or modes; observations quote the user, and
  inferences are separate from observations and never become them; no shame or streak-loss copy.
  The risk-language stop is a narrow fixed phrase list (no AI call, fixed message pointing to human
  help, US 988). It is not a crisis classifier, and nothing may claim it is. AI tools are
  allowlisted and limited. Typed low-risk actions may execute only after checking the user's
  authority setting; interpretive and high-impact changes require confirmation.

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
