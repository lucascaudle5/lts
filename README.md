# Life Tracker Suite (LTS) 1.0

LTS turns messy real-life input — "work Saturday 2–7, test Tuesday, need groceries, I've been
exhausted lately" — into typed, reviewable proposals. You approve, edit, or reject each one; only
approved changes reach your Today view, and every change records where it came from.

**AI interprets and proposes. The user governs.** The rules behind that sentence are in
[`docs/PRODUCT_CONSTITUTION.md`](docs/PRODUCT_CONSTITUTION.md).

> Status: **Complete workspace candidate on the development branch.** Today, schedule, tasks,
> habits, routines, fitness, diet, Mind, projects, money, Review, history/archive, sandbox, settings
> and NOVA capture are implemented. See [parity and boundaries](docs/LEGACY_PARITY.md) and
> [current checks/deployment](docs/STATUS.md).

## Try updates in a browser

Use the Vercel branch Preview linked to the separate lts-dev Supabase database. Main deploys to
Production. No Docker or local services are needed for normal use. The public /demo contains only
fictional data and browser-memory changes; sign in for your saved workspace. Preview builds apply
additive migrations after verifying the environment project references.

## Run it locally

Requirements: Node 22+ and pnpm 10 (`corepack enable` provides pnpm).

```bash
pnpm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
supabase start               # local Postgres + Auth + Mailpit (needs Docker)
pnpm db:migrate
pnpm db:seed                 # fictional user "Sam" with a week of data
pnpm dev                     # http://localhost:4317
```

Then sign in as Sam with the local development password `sam-local-password`:

1. Open <http://localhost:4317> and enter `sam@example.com` and `sam-local-password`.
2. You'll land on Today with Sam's week. The local seed resets this fictional account's password
   each time it runs; never use that password outside local development.

The sign-in form accepts existing accounts only. For a fresh local account, create one in Supabase
Studio first. The `.env.example` defaults match the local stack, including its fixed publishable key.
Open the app at `http://localhost:4317` (not `127.0.0.1`); the sign-in cookie is per host.

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

- `db:migrate`, `db:seed`, and `test:db` read `.env.local` (then `.env`) from the repo root, also
  when an editor saved it as UTF-16 or with a BOM. Variables already set in the shell win. The
  local database URL is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- The seed refuses to run unless `POSTGRES_URL_NON_POOLING` points at `localhost`/`127.0.0.1`. It is
  idempotent: re-running it replaces Sam's rows. On the local Supabase stack it also makes Sam an
  Auth user (`sam@example.com`); on plain Postgres it skips that step.
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

`GET /api/health` returns `{ status, version, commit, db }` (HTTP 503 when the database is
unreachable). It is public and contains no user data.

CI (`.github/workflows/ci.yml`) runs two jobs on every PR and on `main`: `check` (the `pnpm check`
steps plus `pnpm build`) and `db` (a Postgres 17 service container: schema/migration drift check,
`db:migrate`, `db:seed` twice, `test:db`).

## How the repository is organized

```
.github/            CI workflow and issue templates (bug, backlog idea)
db/migrations/      SQL migrations generated from the Drizzle schema
docs/               Constitution, playbook, architecture, ADRs, interim backlog
supabase/           Local Supabase stack config (supabase start)
src/proxy.ts        Refreshes the Supabase session cookie; sends signed-out users to /sign-in
src/app/            Next.js routes and layouts: sign-in, password recovery, today, api/health
src/components/     LTS components (auth, shell, theme, today, life, proposals); ui/ holds shadcn/ui primitives
src/contracts/      zod schemas: domain commands, proposals, tool I/O, Today view, sign-in
src/domain/         Pure rules: dates/times, slots, validation, conflicts, safety
src/server/         auth.ts (requireUser, profile bootstrap), today.ts (Today view model), health
src/server/repositories/  User-scoped reads; userId is always the first argument
src/server/db/      Drizzle schema, DB client, dev seed, script env loading
src/lib/            Small shared utilities
LEGACY.md           Provenance of the old v2.9.7 static build (reference only, not in this repo)
```

Later folders (`src/ai`, `src/server/mutations`, …) are created by the
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
