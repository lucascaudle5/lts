---
cursor:
  subagentId: "bc-ecf16999-a762-5e4d-83e3-ddf053109c87"
---

# Build Sequence: M0 → v1.0

Staged roadmap, not a feature freeze. Finish the minimum M4 harness work, then use
[`../LEGACY_PARITY.md`](../LEGACY_PARITY.md) to restore useful capability. Each release milestone
ends with `pnpm check`, CI green, and an annotated tag. Pull a high-value parity feature forward when
it makes LTS more useful without weakening data safety or the current architecture.

## Current delivery scope

On 2026-10-08 Lucas requested the whole usable app. This branch combines M4 and the manual
capability across all parity sprints. LEGACY_PARITY.md tracks implemented behavior and boundaries;
STATUS.md records checks and deployment. The milestones below remain acceptance guidance.

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
- **Definition of done:** email/password sign-in works locally; Today renders blocks, upcoming, tasks, and
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

## M5: Parity Sprint 1 — Today, Schedule, Tasks → `v0.5.0`

- **Goal:** Lucas can manage a normal work/school day from the browser.
- **Files:** task list/create/status/priority and overdue handling; schedule day/week planning,
  fixed and lightweight recurring commitments, conflict awareness, and direct block edits through
  `runMutations`; Today links to the next action; preserve the capture-to-proposal flow; add the slice
  e2e and deploy to Development.
- **Definition of done:** create and complete/park dated work; inspect a week of commitments; see
  overdue work plainly; resolve schedule conflicts; inspect recurring commitments; use Today to get
  to relevant tasks and blocks.
- **Tests:** task ordering/status and due-date rules, cross-user repository isolation, audited manual
  mutations, schedule conflict cases, and browser coverage of task/capture/Today flow.

## M6: Parity Sprint 2 — Habits and routines → `v0.6.0`

- **Goal:** daily maintenance stays usable after misses, without shame or streak pressure.
- **Files:** habit and routine tables; full/short/minimum variants; anchors, repeat patterns,
  intentional skip, logs, recovery rules, Today integration, and bounded AI read tools where useful.
- **Definition of done:** log a habit; run or intentionally skip a routine; minimum counts when the
  routine defines it; missed items offer a small next step, move, or park.
- **Tests:** recovery rules, minimum completion, tenancy, mutation audit, and copy checks.

## M7: Parity Sprint 3 — Fitness and diet → `v0.7.0`

- **Goal:** replace separate basic workout and meal notes with practical tracking.
- **Files:** workout sessions/exercises/sets, bodyweight notes when Lucas enters them, substitutions,
  meal logs/templates/favorites, optional targets, Today and schedule links.
- **Definition of done:** log a workout and a repeated meal; view progress and upcoming protected
  time; all measurements are explicitly user supplied.
- **Tests:** calculations from entered data only, tenancy, mutation audit, and recovery/substitution
  behavior.

## M8: Parity Sprint 4 — Sleep, capacity, Review, history → `v0.8.0`

- **Goal:** inspect what happened and make evidence-backed adjustments.
- **Files:** user-reported sleep/state observations, weekly Review with cited evidence, expiring
  inferences kept separate from observations, change history and undo.
- **Definition of done:** Review cites observation/run/change ids; history can inspect and recover
  prior changes; no inferred state becomes a user observation.
- **Tests:** evidence requirements, expiry, undo, sensitive-data boundaries, and Review fixture evals.

## M9: Parity Sprint 5 — Projects and money → `v0.9.0`

- **Goal:** cover Lucas's remaining high-value practical areas without building accounting software.
- **Files:** small project records with next actions and status; bills, income/recurring obligations,
  balances where useful, and Today/Review links.
- **Definition of done:** active project next actions and upcoming payments can be reviewed and
  acted on; every field has a screen or decision that uses it.
- **Tests:** due/recurrence rules, tenancy, mutation audit, and overdue behavior.

## M10: LTS 1.0 hardening → `v1.0.0`

- **Goal:** make Development useful for testing and Production safe for durable personal data.
- **Files:** JSON export, backups and migration checks, responsive/mobile fixes, deploy reliability,
  performance, release docs, and bugs found during actual use.
- **Definition of done:** parity success criteria hold in Production; export and recovery work; no
  open data-isolation or silent-mutation defects; tag `v1.0.0`.
- **Tests:** full suite, CI, and manual Development/Production smoke checks.
