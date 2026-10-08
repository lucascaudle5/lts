---
cursor:
  subagentId: "bc-ecf16999-a762-5e4d-83e3-ddf053109c87"
---

# LTS 1.0 Architecture Proposal

The full version is committed in the repo at `docs/ARCHITECTURE.md` (branch
`cursor/lts-successor-skeleton-9c87`), with decisions recorded as ADRs 0001–0008. This page is the
practical summary.

**Core invariant:** all consequential domain mutations go through the same audited mutation layer.
AI-generated mutations additionally require proposal approval.

## Recommended stack and why

| Layer              | Choice                                                                                         | Reason                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend + backend | **One Next.js (App Router) app**, React, TypeScript                                            | The AI harness, model keys, and the mutation transaction need a server. One deployable avoids the legacy static-site + Worker split (with its CORS `*` and unauthenticated endpoint) |
| UI                 | Tailwind + shadcn/ui                                                                           | Accessible primitives, no design-system project                                                                                                                                      |
| Database           | **PostgreSQL on Supabase**                                                                     | Relational data plus atomic multi-table approval and SQL for Review. Free tier, and a local stack via the Supabase CLI                                                               |
| Schema/migrations  | Drizzle ORM → SQL files in `db/migrations/`                                                    | Schema in TypeScript, plain SQL migrations, works on plain Postgres in CI                                                                                                            |
| Auth               | Supabase Auth, email and password                                                              | Comes with the DB; routine sign-in does not depend on email delivery                                                                                                                 |
| Validation         | zod in `src/contracts/`                                                                        | One schema for forms, Server Actions, model output, and tool arguments                                                                                                               |
| AI                 | Own harness; one **Vercel AI Gateway** adapter (via the AI SDK) + an offline **mock** provider | One gateway reaches many models by changing `LTS_AI_MODEL`. It uses an API key locally and OIDC on Vercel, so production stores no model key. Tests and CI need no key               |
| Dates              | date-fns + @date-fns/tz, user timezone in profile                                              | Fixes the legacy UTC/local split                                                                                                                                                     |
| Tests              | Vitest (unit + DB integration), Playwright (one slice e2e)                                     | Fast default; one real end-to-end proof                                                                                                                                              |
| Hosting            | Vercel + Supabase, linked through the Vercel Marketplace                                       | Zero ops, previews per PR, env vars synced automatically, free tiers                                                                                                                 |

**Not a monorepo.** The brief's `apps/*` + `packages/*` boundaries are kept as folders under `src/`
with ESLint import rules. Workspaces would add per-package config for a single consumer (ADR 0008).

## Boundaries

| Folder                 | Owns                                                                                           | Rule                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/contracts`        | zod schemas: proposal kinds, item envelope, tool I/O                                           | imports only zod                                                    |
| `src/domain`           | pure rules: date/time resolution, validation, missing slots, conflicts, routine variant choice | no I/O, `referenceDate` passed in                                   |
| `src/ai`               | harness loop, providers, tool definitions, prompts, eval fixtures                              | never imports the DB directly; calls tool implementations           |
| `src/server/mutations` | `runMutations`: the single gateway for domain writes                                           | the only caller of repository write helpers (lint-enforced)         |
| `src/server`           | Drizzle schema, repositories, approval, tool implementations, auth helpers                     | the only code that touches Postgres; `userId` is the first argument |
| `src/app`              | routes, layouts, thin Server Actions                                                           | parse → `requireUser()` → call server                               |
| `src/components`       | UI (`ui/` = shadcn)                                                                            | types only from contracts                                           |

## Data model (v1)

`profiles`, `captures` (raw text + reference date + timezone), `harness_runs` (durable minimal trace:
provider, model, prompt version, prompt/output SHA-256, tool calls, proposal ids, validation error
codes), `harness_run_payloads` (raw prompt/output text, prunable, off by default), `proposal_items` (typed IR: kind,
payload, original payload, status, missing slots, warnings, source, confidence, quote),
`schedule_blocks`, `tasks`, `observations`, `change_log` (before/after, actor, origin
manual/proposal/undo, grouped by `mutation_id`). M6 adds
`routines`, `routine_variants`, `routine_runs`. M7 adds `inferences` and `reviews`. Connectors
(`links`) and frontier/floor (`focus_areas`) wait in the backlog; the model has room for them.

Every row has `user_id`. RLS is on with **no** anon/authenticated policies, so the public Supabase
key can only do auth and the browser never reads tables.

**Tenancy, stated honestly:** LTS is multi-tenant-conscious, not multi-tenant-safe by construction.
The server's `POSTGRES_URL` connection bypasses RLS, so a repository query missing its `user_id`
filter could leak another user's data. Cross-user isolation tests for every repository function and
tool are the mitigation, not a guarantee.

## Contracts

The proposal kinds are a discriminated union: `schedule_block.create`, `task.create`,
`observation.record` in the slice; `schedule_block.update`, `task.update` in M5;
`routine_run.log` in M6. Each item carries `status` (`needs_input` | `ready` | `approved` |
`rejected` | `applied` | `failed`), `missingSlots[]`, typed `warnings[]` (the legacy ambiguity
reasons become codes such as `date_from_weekday` and `time_assumed_pm`), and `provenance`
(source model/parser/user, model id, prompt version, run id, the exact `quote`, confidence).

## Life-compiler pipeline

capture → interpret (AI harness, or the deterministic parser for explicit/simple input or outages)
→ zod schema validation → deterministic normalization (explicit dates/times in the quote override
the model's, an idea taken from the legacy Worker) → grounding and safety (quote ⊂ capture;
observations quote the user; diagnosis/medication denylist; interpretations never typed as
observations) → business validation (end > start, conflicts with fixed blocks, duplicate tasks) →
missing slots → user approval → mutation layer (one transaction) → Today reads from the DB.

## AI harness

- `ModelProvider.generate({ system, messages, tools, output })` plus `capabilities(model)`. Adapters:
  `gateway` (Vercel AI Gateway via the AI SDK; `AI_GATEWAY_API_KEY` locally, the project's OIDC
  token on Vercel) and `mock`.
- `ProviderCapabilities { toolCalling, structuredOutput, maxContextTokens, streaming }` is a type and
  a static per-model table, not a capability system. The harness branches on it (no tool calling →
  pre-fetch context in a single call; no structured output → JSON in text, still zod-validated).
  Unknown models get the most conservative values.
- At most 4 tool rounds; allowlisted, user-scoped read tools with row/time limits:
  `get_today`, `get_schedule` (≤ 14 days), `list_open_tasks` (≤ 50),
  `get_recent_observations` (opt-in categories only). The only output channel is
  `submit_proposals`.
- One retry with the validation error appended; then fall back to the parser and label the result
  "interpreted without AI".
- Every run (including failures) gets a `harness_runs` metadata row. Prompts are versioned constants.
- **Trace privacy:** store the minimum AI trace needed for provenance and debugging.
  `LTS_AI_TRACE_MODE=metadata` (the default, used in production) stores no raw text. `full` stores
  raw prompt/output in `harness_run_payloads` with `expires_at = now + LTS_AI_TRACE_RETENTION_DAYS`
  (default 7). Expired payloads are pruned at the start of each harness call and by `pnpm ai:prune`.
  Provenance never depends on payloads.
- Golden fixtures (including the legacy test prompts) run in CI against the mock provider;
  `pnpm eval` runs them against the configured gateway model.
- Brief tools that wait for later milestones: `get_recent_routines` (M6), `search_history`,
  `propose_inference`, `create_review` (M7). `get_active_projects`, `get_active_frontier`, and
  `propose_routine_change` stay in the backlog. `record_observation` becomes the
  `observation.record` **proposal** kind, because no model output writes directly.

## Mutation layer, approval, and provenance

`runMutations(ctx, commands)` is the single gateway for consequential writes. For every call it
validates the commands, authorizes every referenced row against `ctx.userId`, writes, records
`change_log` and provenance, and does all of it in one transaction (any failure rolls back
everything). Two paths use it:

- **AI/parser:** proposal → user approval → `approveItems` maps ready items to commands → mutation
  layer → items marked `applied`. `approveItems` itself never writes domain tables.
- **Manual (Article 6):** create/edit/delete forms and Undo (M5) → mutation layer, with
  `origin: manual` or `undo`.

Rejections only update `proposal_items`. `original_payload` is kept, so the difference between
model output and what was approved becomes an eval signal. Each domain row points back through `origin_item_id` →
proposal item → harness run + capture, so "where did this come from?" always has an answer.

## Auth

Supabase email/password credentials. The Next.js proxy refreshes the session, and `requireUser()` runs in every
action. The first sign-in creates the profile with the browser timezone. The app is single-user in
practice and multi-tenant-conscious (see Data model).

## Health and safety

No diagnosis, no medication advice, no identity labels, no silent writes to health-adjacent data,
and no shame copy. A risk-language stop is deliberately narrow: a small fixed phrase check before
interpretation, then no AI call, no proposals, and a fixed message pointing to human help (US: call
or text 988). It is explicitly not a crisis classifier: no scoring, no inference, no monitoring. AI access
to sensitive categories is opt-in per category and logged. Operating-state values are inferences
with evidence and an expiry, never personality modes.

## Testing

Unit: domain table tests (dates pinned to a reference date and timezone), contracts, safety
denylist. AI: a scripted mock provider exercises tool limits, invalid output, retry, fallback,
trace modes, and capability branches, plus golden fixtures. DB integration (Postgres service in CI):
the mutation layer on both paths (authorization, atomicity, rollback, `change_log`, provenance),
cross-user isolation for every repository function and tool, payload pruning. One Playwright e2e of the slice.

## Deployment

Vercel linked to GitHub (previews per PR, production from `main`). The Supabase project is created
through the Vercel Marketplace in the AWS region closest to the function region (`us-east-1` for the
default `iad1`), which syncs `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, and the public Supabase
URL/key. Runtime uses the pooled URL with prepared statements off. Migrations run with
`pnpm db:migrate` on the non-pooled URL before promoting. AI Gateway auth on Vercel is OIDC.
Step by step: [hosting-setup.md](hosting-setup.md). `/api/health` reports version and DB
reachability. Then a manual slice smoke test.

## Where this deviates from the brief

See [index.md](index.md#deviations-from-the-brief).
