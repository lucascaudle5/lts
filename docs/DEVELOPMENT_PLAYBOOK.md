# Development Playbook

How LTS gets built, day to day. Product rules live in `PRODUCT_CONSTITUTION.md`; system design in
`ARCHITECTURE.md`.

## Milestones

Work happens in this order. Each milestone ends with `pnpm check` green on `main` and a tag.

| #   | Goal                                                                            | Tag      |
| --- | ------------------------------------------------------------------------------- | -------- |
| M0  | Repo skeleton, docs, CI                                                         | `v0.0.0` |
| M1  | Contracts (zod), DB schema + migrations, seed script, local Supabase            | `v0.1.0` |
| M2  | Sign-in, app shell, read-only Today from the database                           | `v0.2.0` |
| M3  | Capture → deterministic parser → proposal review → approval transaction → Today | `v0.3.0` |
| M4  | AI harness: provider adapter + mock, read tools, validation, fallback, evals    | `v0.4.0` |
| M5  | Slice hardening: edits/updates as diffs, history + undo, e2e, first deploy      | `v0.5.0` |
| M6  | Routines with full/short/minimum variants and recovery suggestions              | `v0.6.0` |
| M7  | Weekly Review over history; inferences as proposals                             | `v0.7.0` |
| M8  | Freeze: fixes, export, docs, production verification                            | `v1.0.0` |

**Not in the plan:** anything else. New ideas go to the backlog (GitHub Issues with the `backlog`
label, or `docs/BACKLOG.md` until the GitHub repo exists). Pull one in only if it blocks the current
milestone — and say which demonstrated problem it solves in the PR.

## Daily loop

```bash
git switch main && git pull
git switch -c feat/m3-approval-transaction   # one branch per meaningful piece of work
pnpm dev                                      # http://localhost:4317
# ...small commits...
pnpm check                                    # lint + format + typecheck + tests
git push -u origin HEAD                       # open a PR to main, let CI run, merge, delete branch
```

Branch prefixes: `feat/`, `fix/`, `docs/`, `chore/`, `spike/` (spikes are thrown away, never
merged). Commit messages: imperative, specific (`Add approval transaction with change_log`).

## Coding conventions

- TypeScript `strict`. No `any` in `contracts`, `domain`, `server`. Prefer `unknown` + zod at edges.
- Every external input (form data, route params, model output, tool arguments) is parsed with a
  zod schema from `src/contracts` before use.
- `domain` and `contracts` are pure functions: no `Date.now()` (pass `referenceDate`), no I/O.
- Database access only in `src/server/**` repositories. Repositories take `userId` first.
- Server Actions stay thin: parse → `requireUser()` → call server function → return a typed result.
- Name things after the product (`approveItems`, `resolveWeekday`), not after patterns (`Manager`,
  `Helper`).
- Comments explain constraints the code cannot show; don't narrate.
- UI copy follows Article 4: no guilt, no streak-loss language, no fake precision.

## Tests

- Every `domain` function gets table-driven Vitest tests. Date/time resolution tests pin
  `referenceDate` and `timezone`.
- Every bug fix starts with a failing test.
- Every new proposal kind needs: a contract test, a validation test, an approval-transaction test,
  and at least one golden fixture.
- DB integration tests (`*.db.test.ts`, from M1) run against a disposable Postgres; each test runs in
  a transaction that is rolled back.
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
that stops here). Seeds are idempotent and refuse to run when `DATABASE_URL` is not local.
Golden AI fixtures double as seed-able captures.

## AI structured output

- The model's only way to return changes is `submit_proposals`; anything else is ignored.
- Parse with the zod contract; on failure, retry once with the validation error appended, then fall
  back to the deterministic parser. Record every attempt in `harness_runs`.
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
2. Find the stage: open the `harness_runs` row (raw output, validation errors) → `proposal_items`
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
2. `pnpm db:migrate` against production if the release has migrations.
3. Tag: `git tag -a v0.3.0 -m "M3: approval loop"` and `git push origin v0.3.0`.
4. After deploy: `/api/health` shows the new version and `db: ok`; run the slice manually once
   (capture "dentist friday 3-4pm" → approve → appears on Today → Undo).
