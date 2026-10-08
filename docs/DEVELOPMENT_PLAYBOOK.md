# Development Playbook

How LTS gets built, day to day. Product rules live in `PRODUCT_CONSTITUTION.md`; system design in
`ARCHITECTURE.md`.

## Milestones

Work happens in this order. Each milestone ends with `pnpm check` green on `main` and a tag.

| #   | Goal                                                                                                   | Tag      |
| --- | ------------------------------------------------------------------------------------------------------ | -------- |
| M0  | Repo skeleton, docs, CI                                                                                | `v0.0.0` |
| M1  | Contracts (zod), DB schema + migrations, seed script, local Supabase                                   | `v0.1.0` |
| M2  | Sign-in, app shell, read-only Today from the database                                                  | `v0.2.0` |
| M3  | Capture → parser → proposal review → approval → mutation layer → Today                                 | `v0.3.0` |
| M4  | AI harness: provider adapter + mock, read tools, validation, fallback, evals                           | `v0.4.0` |
| M5  | Slice hardening: manual edits + update diffs via the mutation layer, history + undo, e2e, first deploy | `v0.5.0` |
| M6  | Routines with full/short/minimum variants and recovery suggestions                                     | `v0.6.0` |
| M7  | Weekly Review over history; inferences as proposals                                                    | `v0.7.0` |
| M8  | Freeze: fixes, export, docs, production verification                                                   | `v1.0.0` |

**Current scope:** Lucas authorized the complete manual workspace and legacy parity on 2026-10-08. See LEGACY_PARITY.md and STATUS.md. New ideas go to the backlog (GitHub Issues with the `backlog`
label, or `docs/BACKLOG.md` until the GitHub repo exists). Pull one in only if it blocks the current
milestone — and say which demonstrated problem it solves in the PR.

## Stack lock

From M1 on, replacing Next.js, Supabase, Drizzle, the proposal/mutation architecture, or the
repository structure is not discussed unless implementation produces concrete evidence that it is
blocking: a failing test, a measured limit, or a requirement that cannot be met. That evidence opens
an ADR (see `docs/adr/README.md`). Otherwise the idea goes to the backlog like any other.

## Daily loop

```bash
git switch main && git pull
git switch -c feat/m3-mutation-layer         # one branch per meaningful piece of work
pnpm dev                                      # http://localhost:4317
# ...small commits...
pnpm check                                    # lint + format + typecheck + tests
git push -u origin HEAD                       # open a PR to main, let CI run, merge, delete branch
```

Branch prefixes: `feat/`, `fix/`, `docs/`, `chore/`, `spike/` (spikes are thrown away, never
merged). Commit messages: imperative, specific (`Add mutation layer with change_log`).

## Coding conventions

- TypeScript `strict`. No `any` in `contracts`, `domain`, `server`. Prefer `unknown` + zod at edges.
- Every external input (form data, route params, model output, tool arguments) is parsed with a
  zod schema from `src/contracts` before use.
- `domain` and `contracts` are pure functions: no `Date.now()` (pass `referenceDate`), no I/O.
- Database access only in `src/server/**` repositories. Repositories take `userId` first.
- Domain tables are written only through `runMutations` (`src/server/mutations/`), for AI proposals
  and manual edits alike. Never call a repository write helper from anywhere else; ESLint enforces it.
- Server Actions stay thin: parse → `requireUser()` → call server function → return a typed result.
- Name things after the product (`approveItems`, `resolveWeekday`), not after patterns (`Manager`,
  `Helper`).
- Comments explain constraints the code cannot show; don't narrate.
- UI copy follows Article 4: no guilt, no streak-loss language, no fake precision.

## Tests

- Every `domain` function gets table-driven Vitest tests. Date/time resolution tests pin
  `referenceDate` and `timezone`.
- Every bug fix starts with a failing test.
- Every new command kind needs: a contract test, a validation test, mutation-layer tests for the
  manual and the proposal path (including authorization and rollback), and at least one golden
  fixture.
- Every repository function and AI tool gets a cross-user isolation test (user B sees and changes
  nothing of user A's). These are the main tenancy control, because the server connection bypasses
  RLS; they lower the risk, they don't prove its absence.
- DB integration tests (`*.db.test.ts`, from M1, `pnpm test:db`) run against a disposable Postgres:
  each test file migrates its own fresh database and drops it afterwards, and tests that write
  outside the seed run in a transaction that is rolled back. `pnpm test` stays database-free.
- The slice e2e (from M5) must stay green; it is the definition of "LTS works".

## Schema and migrations

1. Edit `src/server/db/schema.ts`.
2. `pnpm db:generate` → new file in `db/migrations/`. Read the SQL.
3. `pnpm db:migrate` locally; run tests.
4. Commit schema + migration together.

Rules: forward-only; never edit an applied migration; destructive changes in two releases (stop
using, then drop); every table has `user_id`, `created_at`, RLS enabled with no anon/authenticated
policies.

## Seed and dev data

`pnpm db:seed` (M1) creates a fictional student, "Sam", with a week of blocks, tasks, and two
observations — never real personal data (the legacy defaults embedded real-looking body metrics;
that stops here). Seeds are idempotent and refuse to run when `POSTGRES_URL_NON_POOLING` is not
local. Once `runMutations` exists (M3), seeds go through it; the M1 seed writes rows directly
because the mutation layer does not exist yet.
Golden AI fixtures double as seed-able captures.

## AI structured output

- The model has no database access. A bounded typed action passes an authority and risk check; an
  explicitly allowed low-risk command may execute directly, while interpretive or high-impact actions
  return through `submit_proposals` for confirmation.
- Parse with the zod contract; on failure, retry once with the validation error appended, then fall
  back to the deterministic parser. Record every attempt in `harness_runs`.
- Keep traces minimal: `LTS_AI_TRACE_MODE=metadata` in production. Switch a local or preview
  environment to `full` only while debugging a specific bug; payloads expire after
  `LTS_AI_TRACE_RETENTION_DAYS` and `pnpm ai:prune` removes them early.
- Branch on `ProviderCapabilities`, never on provider or model names.
- Deterministic normalization wins over model values when the quote is explicit.
- Never show a half-valid item. Drop it and say how many were dropped.
- Prompt changes bump `PROMPT_VERSION` and must keep `pnpm test` (mock fixtures) green; run
  `pnpm eval` against the real provider before merging and paste the score in the PR.

## Secrets

- Real values only in `.env.local` (git-ignored) and in Vercel/Supabase dashboards.
- `.env.example` documents every variable and which milestone needs it.
- Anything prefixed `NEXT_PUBLIC_` is public by definition; model keys never get that prefix.
- If a secret is committed: rotate it first, then remove it from history.

## Debugging flow

1. Reproduce with the exact capture text and reference date; add it as a failing fixture or test.
2. Find the stage: open the `harness_runs` row (tool calls, validation error codes, hashes; raw text
   only if the run was in `full` trace mode) → `proposal_items`
   (payload vs original_payload, warnings) → `change_log`.
3. Fix at the earliest stage that was wrong (contract → normalization → validation → UI).

## Rollback

- Bad merge on `main`: `git revert <sha>` (or `git revert -m 1 <merge-sha>`), push, redeploy. No
  force-pushes to `main`.
- Bad deploy: promote the previous Vercel deployment, then revert.
- Bad data change: Undo from History (M5) or apply the inverse from `change_log.before`.
- Bad migration: write a new forward migration that repairs it.

## Release and deployment verification

1. `pnpm check` and CI green on `main`.
2. `pnpm db:migrate` against production (`POSTGRES_URL_NON_POOLING`) if the release has migrations.
3. Tag: `git tag -a v0.3.0 -m "M3: approval loop"` and `git push origin v0.3.0`.
4. After deploy: `/api/health` shows the new version and `db: ok`; run the slice manually once
   (capture "dentist friday 3-4pm" → approve → appears on Today → Undo).

## Hosting setup (short version)

Do this once, ideally right after the GitHub repo exists (the M0 skeleton deploys as-is; a DB is
needed from M2). The full student-friendly walkthrough is in the project's hosting setup guide.

1. **Vercel:** sign in with GitHub → Add New → Project → import the LTS repo → Deploy. Note the
   function region (Settings → Functions; default `iad1`, Washington, D.C.).
2. **Supabase via Vercel Marketplace:** in the Vercel project → Storage → create a Supabase database
   (or run `vc i supabase` from the repo with the Vercel CLI), pick the AWS region closest to the function region
   (`us-east-1` for `iad1`), connect it to Production and Development only (previews would otherwise
   share real data). This syncs `POSTGRES_URL`,
   `POSTGRES_URL_NON_POOLING`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
   more. (Alternative: create the project at supabase.com and copy the same values into Vercel by
   hand.)
3. **Auth URLs:** Supabase → Authentication → URL Configuration → Site URL = the production URL;
   Redirect URLs += `http://localhost:4317/**` (plus the Vercel preview pattern only if previews get
   their own database).
4. **Env vars on Vercel:** add `NEXT_PUBLIC_SITE_URL`, `LTS_AI_PROVIDER=gateway`, `LTS_AI_MODEL`,
   `LTS_AI_TRACE_MODE=metadata`. Do **not** add `AI_GATEWAY_API_KEY`; deployments use OIDC.
5. **Locally:** keep the local Supabase stack values in `.env.local`; create an AI Gateway API key
   (Vercel → AI Gateway → API Keys) for local `AI_GATEWAY_API_KEY`, ideally with a budget.
6. **Migrations:** `vercel env pull .env.production.local --environment=production`, then run
   `pnpm db:migrate` with that file loaded. Delete the file afterwards.
7. **Deploy:** merge to `main`. Open the same production URL on phone and laptop and sign in with
   the same email; both read the same database, so data is in sync. Don't keep real data on
   preview URLs.

## Hosted dev workflow

Normal testing means opening the Vercel Preview site. One Vercel project deploys main to Production
and branches/PRs to Preview. Preview connects to lts-dev Supabase; Production connects to lts.
Non-exportable Preview Secrets are available to hosted builds; do not weaken them to pull locally.
The build checks the project references and applies additive migrations before building. No local
Docker/database is needed for normal browser use. Disposable DB integration tests remain a release gate.

Gateway evaluation is paced for the account quota. Run pnpm eval with LTS_AI_MODEL and a Gateway key
or fresh Vercel OIDC token. Diagnostic fake-fixture results go to ignored test-results/ai-eval.json.
A failed evaluation is not a passing M4 acceptance.
