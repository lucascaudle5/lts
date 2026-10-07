---
cursor:
  subagentId: "bc-ecf16999-a762-5e4d-83e3-ddf053109c87"
---

# Build Sequence: M0 → v1.0

Ordered. Each milestone ends with `pnpm check` + CI green on `main` and an annotated tag. The
anti-rewrite rule applies to every row: if it isn't listed under the milestone, it isn't built in
that milestone.

## M0: Repository skeleton (done, branch `cursor/lts-successor-skeleton-9c87`) → `v0.0.0`

- **Goal:** a buildable, governed empty project.
- **Files:** Next.js app shell, `package.json` scripts, ESLint/Prettier/TS/Vitest config, CI
  workflow, `.editorconfig`, `.nvmrc`, `.env.example`, `.gitignore`, `LICENSE`, `LEGACY.md`,
  `README.md`, `docs/` (constitution, architecture, playbook, backlog, ADRs 0001–0008), issue
  templates, `db/migrations/README.md`.
- **Definition of done:** `pnpm check` and `pnpm build` pass; no legacy code in history; pushed.
- **Tests:** toolchain smoke test (`src/lib/utils.test.ts`).
- **Do not build yet:** any feature, DB, auth.

## M1: Contracts and database → `v0.1.0`

- **Goal:** typed data that can be stored, migrated, and seeded.
- **Files:** `src/contracts/{common,proposals,tools}.ts`; `src/domain/{dates,validate,slots,conflicts,safety}.ts`;
  `src/server/db/{schema,client,seed}.ts`; `db/migrations/0000_init.sql`; `supabase/config.toml`;
  `drizzle.config.ts`; ESLint `no-restricted-imports` boundaries; scripts `db:generate`,
  `db:migrate`, `db:seed`; CI Postgres service.
- **Definition of done:** `supabase start && pnpm db:migrate && pnpm db:seed` works on a clean
  machine; all v1 tables exist with `user_id`, RLS enabled, no anon/authenticated policies; the seed
  refuses non-local URLs.
- **Tests:** contracts round-trip; date resolution table (includes `sat`/`mon` and `7am-8am`
  regressions); slots/validation/conflicts/safety; migration applies to empty Postgres in CI.
- **Do not build yet:** UI, auth flow, AI, routines/inferences tables.

## M2: Sign-in, shell, read-only Today → `v0.2.0`

- **Goal:** a signed-in user sees their real (seeded) day.
- **Files:** `src/app/(auth)/sign-in/`, `src/app/today/`, Next.js proxy for session refresh,
  `src/server/auth.ts` (`requireUser`, profile bootstrap), `src/server/repositories/{blocks,tasks,observations}.ts`,
  `src/components/today/*`, `src/app/api/health/route.ts`.
- **Definition of done:** magic-link sign-in works locally; Today renders blocks, upcoming, tasks, and
  observations from the DB, with empty/loading/error states, on 375 px and desktop; signed-out users
  are redirected.
- **Tests:** repository user-scoping (user B sees nothing of user A); Today view-model builder;
  health route.
- **Do not build yet:** capture, proposals, manual edit forms beyond the minimum (Article 6 edit/delete
  comes in M5), AI.

## M3: Capture → parser → proposals → approval → Today → `v0.3.0`

- **Goal:** the full approval loop working **without AI**.
- **Files:** capture box on Today; `src/server/parser/`; `src/server/compiler/interpretCapture.ts`
  (parser path); `src/server/repositories/{captures,proposals,changeLog}.ts`;
  `src/server/mutations/runMutations.ts` (validate → authorize → write → change_log → provenance, one transaction); `src/server/approval/{approveItems,rejectItems}.ts` (calls the mutation layer); `src/app/captures/[id]/`;
  `src/components/proposals/{ItemCard,SlotChip,DiffRow}.tsx`; Server Actions from the slice spec.
- **Definition of done:** "dentist friday 3-4pm, need groceries" → review → approve → appears on
  Today with provenance; slots block approval; rejected items write nothing; failures roll back.
- **Tests:** parser golden fixtures (legacy prompts); mutation-layer authorization, atomicity, and
  rollback; `change_log` contents; `approveItems` writes only via `runMutations`; "interpret writes no domain rows"; slot gating.
- **Do not build yet:** model calls, updates/deletes as proposals, undo, history screen.

## M4: AI harness → `v0.4.0`

- **Goal:** messy input interpreted by a model, safely and replaceably.
- **Files:** `src/ai/{harness,provider,eval}.ts`; `src/ai/providers/{gateway,mock}.ts` (Vercel AI Gateway via the AI SDK); `ProviderCapabilities` type + static table;
  `src/ai/prompts/interpret.ts`; `src/ai/fixtures/*.json` (≥ 20); `src/server/tools/*` (4 read
  tools); `harness_runs` + prunable `harness_run_payloads` with `LTS_AI_TRACE_MODE` / retention and `pnpm ai:prune`; compiler chooses harness → parser fallback; sensitive-category
  opt-in setting (one toggle list on a minimal settings section).
- **Definition of done:** the worked example in the slice spec yields the expected items with the
  mock provider; through the AI Gateway (API key locally) `pnpm eval` ≥ 90% field accuracy;
  provider failure falls back visibly; every run is logged.
- **Tests:** scripted-mock harness tests (retry, fallback, allowlist, limits, round cap, grounding,
  safety denylist, no domain writes); fixture suite on mock in CI.
- **Do not build yet:** chat UI, history Q&A, inferences, Review, streaming, multiple prompt
  strategies, provider SDKs.

## M5: Slice hardening and first deploy → `v0.5.0`

- **Goal:** trustworthy enough to use daily.
- **Files:** proposal kinds `schedule_block.update`, `task.update` with before/after diff;
  direct edit/delete for blocks and tasks (Article 6) through `runMutations` (`origin: manual`);
  `src/server/mutations/undoChange.ts` (`origin: undo`);
  `src/app/history/`; `e2e/slice.spec.ts`, `playwright.config.ts`; CI e2e job (Supabase CLI in
  Actions); Vercel + Supabase (Marketplace) + AI Gateway production setup per hosting-setup.md; `/api/health` with version.
- **Definition of done:** slice e2e green in CI; deployed; Lucas uses it for real captures for a week
  and files bugs (not features) from that week.
- **Tests:** e2e slice (proposal path and manual path); undo restores `before`; update diffs;
  conflict warnings on edits; OIDC auth works on the deployed preview.
- **Do not build yet:** routines, Review, recurring blocks, notifications, PWA.

## M6: Routines with recovery variants → `v0.6.0`

- **Goal:** one recurring feature that turns misses into smaller next steps.
- **Files:** `routines`, `routine_variants`, `routine_runs` migration; `src/domain/routines.ts`
  (variant suggestion rule); `src/app/routines/`; Today routine panel; proposal kind
  `routine_run.log`; tool `get_recent_routines`.
- **Definition of done:** create a routine with full/short/minimum; Today suggests a variant with a
  cited reason; logging the minimum counts as done; a miss offers minimum/move/skip with no penalty
  language.
- **Tests:** suggestion rule table; copy check (no streak/shame words) as a unit test over UI strings;
  `routine_run.log` approval.
- **Do not build yet:** streaks, scores, habit stats dashboards, fitness programming.

## M7: Weekly Review and inferences → `v0.7.0`

- **Goal:** Review can reason over history without turning guesses into facts.
- **Files:** `inferences`, `reviews` migration; tools `search_history`, `propose_inference`,
  `create_review`; `src/app/review/`; dismissal memory for suggestions.
- **Definition of done:** a weekly review draft cites the observation/run/change ids it used; every
  inference shows evidence, confidence, and expiry, and is accept/reject only; accepting never
  creates an observation.
- **Tests:** inference must cite ≥ 1 observation; expiry; Review fixture evals; safety denylist on
  review text.
- **Do not build yet:** connectors, frontier/floor UI, operating-state dashboard, money/diet/fitness
  domains.

## M8: Freeze → `v1.0.0`

- **Goal:** finish.
- **Files:** JSON export; README/ARCHITECTURE refresh; bug fixes from real use; migrate
  `docs/BACKLOG.md` to GitHub Issues if not done.
- **Definition of done:** all success criteria in the slice spec hold in production; export works;
  no open "state changed without approval" bugs; tag `v1.0.0`.
- **Tests:** full suite + manual production smoke.
- **Do not build yet:** everything in the backlog. That becomes v1.1, chosen on evidence from
  using v1.0.
