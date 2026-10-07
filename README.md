# Life Tracker Suite (LTS) 1.0

LTS turns messy real-life input — "work Saturday 2–7, test Tuesday, need groceries, I've been
exhausted lately" — into typed, reviewable proposals. You approve, edit, or reject each one; only
approved changes reach your Today view, and every change records where it came from.

**AI interprets and proposes. The user governs.** The rules behind that sentence are in
[`docs/PRODUCT_CONSTITUTION.md`](docs/PRODUCT_CONSTITUTION.md).

> Status: **M1 — contracts and database.** Typed contracts, pure domain rules, the Postgres schema,
> migrations, and a dev seed exist; the app still shows a placeholder page. Sign-in and Today arrive
> in M2, the capture → approval loop in M3, AI in M4. See the milestone table in
> [`docs/DEVELOPMENT_PLAYBOOK.md`](docs/DEVELOPMENT_PLAYBOOK.md#milestones).

## Run it locally

Requirements: Node 22+ and pnpm 10 (`corepack enable` provides pnpm).

```bash
pnpm install
cp .env.example .env.local   # the defaults point at the local Supabase stack
pnpm dev                      # http://localhost:4317
```

### Database

The database needs Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase`
on your PATH, or prefix the commands with `npx`). No hosted Supabase project or credentials are
needed for development or tests.

```bash
supabase start     # local Postgres on 127.0.0.1:54322 (+ Auth, Studio on :54323)
pnpm db:migrate    # apply db/migrations/ (Drizzle) to POSTGRES_URL_NON_POOLING
pnpm db:seed       # replace the fictional user "Sam" with a fresh week of data
pnpm test:db       # DB integration tests (create and drop their own database)
supabase stop      # when you're done
```

- The seed refuses to run unless `POSTGRES_URL_NON_POOLING` points at `localhost`/`127.0.0.1`. It is
  idempotent: re-running it replaces Sam's rows.
- Without the Supabase CLI, any local Postgres 17 works for migrations, seed, and tests, e.g.
  `docker run -d -p 54322:5432 -e POSTGRES_PASSWORD=postgres postgres:17`. CI does exactly this
  with a service container.
- Changing the schema: edit `src/server/db/schema.ts`, run `pnpm db:generate`, read the new SQL in
  `db/migrations/`, and commit both. CI fails if the schema and migrations disagree.

## Commands

| Command            | Does                                                             |
| ------------------ | ---------------------------------------------------------------- |
| `pnpm dev`         | Dev server on port 4317                                          |
| `pnpm build`       | Production build                                                 |
| `pnpm lint`        | ESLint, zero warnings allowed                                    |
| `pnpm format`      | Prettier write (`format:check` to verify only)                   |
| `pnpm typecheck`   | Generate route types, then `tsc --noEmit`                        |
| `pnpm test`        | Unit tests once (`test:watch` while working); no database needed |
| `pnpm check`       | lint + format check + typecheck + tests — run before every push  |
| `pnpm test:db`     | DB integration tests (`*.db.test.ts`) against local Postgres     |
| `pnpm db:generate` | Generate a migration from `src/server/db/schema.ts`              |
| `pnpm db:migrate`  | Apply migrations to `POSTGRES_URL_NON_POOLING`                   |
| `pnpm db:seed`     | Seed the fictional user "Sam" (local databases only)             |

CI (`.github/workflows/ci.yml`) runs the `pnpm check` steps plus `pnpm build` on every PR and on
`main`. DB integration tests (`pnpm test:db`) currently run locally only; CI gets a Postgres service
container job for them next.

## How the repository is organized

```
.github/            CI workflow and issue templates (bug, backlog idea)
db/migrations/      SQL migrations generated from the Drizzle schema
docs/               Constitution, playbook, architecture, ADRs, interim backlog
supabase/           Local Supabase stack config (supabase start)
src/app/            Next.js routes and layouts
src/components/ui/  shadcn/ui primitives
src/contracts/      zod schemas: domain commands, proposals, tool I/O
src/domain/         Pure rules: dates/times, slots, validation, conflicts, safety
src/server/db/      Drizzle schema, DB client, dev seed
src/lib/            Small shared utilities
LEGACY.md           Provenance of the old v2.9.7 static build (reference only, not in this repo)
```

Later folders (`src/ai`, `src/server/repositories`, `src/server/mutations`, …) are created by the
milestone that first needs them. Responsibilities and import rules are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#source-layout-and-import-boundaries); ESLint enforces
them (`eslint.config.mjs`, tested in `src/import-boundaries.test.ts`).

## Docs

- [Product constitution](docs/PRODUCT_CONSTITUTION.md) — the rules that settle arguments
- [Architecture](docs/ARCHITECTURE.md) — boundaries, data model, AI harness, approval flow
- [Development playbook](docs/DEVELOPMENT_PLAYBOOK.md) — milestones, workflow, tests, migrations, releases
- [Architecture decision records](docs/adr/README.md)

## Where work is tracked

- **Current milestone:** the table in the playbook; one feature branch + PR per meaningful change.
- **Backlog:** GitHub Issues labeled `backlog` once the GitHub repository exists; until then,
  [`docs/BACKLOG.md`](docs/BACKLOG.md). Ideas wait there unless they unblock the current milestone.

## Environment variables

All variables are documented in [`.env.example`](.env.example) with the milestone that needs them.
Secrets live only in `.env.local` and in the Vercel/Supabase dashboards — never in git.

## Deployment

Vercel hosts the app (production from `main`, previews per PR). Supabase is created through the
Vercel Marketplace, so the database env vars sync automatically, in the AWS region closest to the
Vercel function region. AI calls go through the Vercel AI Gateway: an API key locally, OIDC when
deployed. Use one production URL and one account on phone and laptop, and the data stays in sync.
The step-by-step version is the playbook's
["Hosting setup"](docs/DEVELOPMENT_PLAYBOOK.md#hosting-setup-short-version) section; release checks are
in "Release and deployment verification".

## License

All rights reserved for now (see [`LICENSE`](LICENSE)). LTS holds personal-life data models and
is a personal project; an open-source license can be chosen later without affecting anything else
in the repo.
