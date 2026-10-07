# Life Tracker Suite (LTS) 1.0

LTS turns messy real-life input — "work Saturday 2–7, test Tuesday, need groceries, I've been
exhausted lately" — into typed, reviewable proposals. You approve, edit, or reject each one; only
approved changes reach your Today view, and every change records where it came from.

**AI interprets and proposes. The user governs.** The rules behind that sentence are in
[`docs/PRODUCT_CONSTITUTION.md`](docs/PRODUCT_CONSTITUTION.md).

> Status: **M0 — repository skeleton.** The app builds and shows a placeholder page. Sign-in and
> Today arrive in M2, the capture → approval loop in M3, AI in M4. See the milestone table in
> [`docs/DEVELOPMENT_PLAYBOOK.md`](docs/DEVELOPMENT_PLAYBOOK.md#milestones).

## Run it locally

Requirements: Node 22+ and pnpm 10 (`corepack enable` provides pnpm).

```bash
pnpm install
cp .env.example .env.local   # nothing is required yet in M0
pnpm dev                      # http://localhost:4317
```

From M1 you will also need Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli) for
the local database (`supabase start`).

## Commands

| Command          | Does                                                            |
| ---------------- | --------------------------------------------------------------- |
| `pnpm dev`       | Dev server on port 4317                                         |
| `pnpm build`     | Production build                                                |
| `pnpm lint`      | ESLint, zero warnings allowed                                   |
| `pnpm format`    | Prettier write (`format:check` to verify only)                  |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit`                       |
| `pnpm test`      | Vitest once (`test:watch` while working)                        |
| `pnpm check`     | lint + format check + typecheck + tests — run before every push |

CI (`.github/workflows/ci.yml`) runs the same checks plus `pnpm build` on every PR and on `main`.

## How the repository is organized

```
.github/            CI workflow and issue templates (bug, backlog idea)
db/migrations/      SQL migrations generated from the Drizzle schema (from M1)
docs/               Constitution, playbook, architecture, ADRs, interim backlog
src/app/            Next.js routes and layouts
src/components/ui/  shadcn/ui primitives
src/lib/            Small shared utilities
LEGACY.md           Provenance of the old v2.9.7 static build (reference only, not in this repo)
```

Planned folders (`src/contracts`, `src/domain`, `src/ai`, `src/server`) are created by the milestone
that first needs them; their responsibilities and import rules are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#source-layout-and-import-boundaries).

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

Planned for M5: Vercel (app, previews per PR) + Supabase (Postgres + Auth). Steps and post-deploy
checks are in the playbook's "Release and deployment verification" section.

## License

All rights reserved for now (see [`LICENSE`](LICENSE)). LTS holds personal-life data models and
is a personal project; an open-source license can be chosen later without affecting anything else
in the repo.
