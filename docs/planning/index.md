---
cursor:
  subagentId: "bc-ecf16999-a762-5e4d-83e3-ddf053109c87"
---

> **Note (2026-10-08).** The constitution amendments in
> [`PRODUCT_CONSTITUTION.md`](../PRODUCT_CONSTITUTION.md) and
> [ADR 0011](../adr/0011-constitution-amendments-2026-10-08.md) override this document where it
> says "no streaks" or "no scores" (streaks are allowed as factual continuity metrics; self-reported
> numeric scales are allowed when labeled) or says AI-generated mutations always need proposal
> approval (allowlisted direct execution is allowed). Kept as written for history.

# NOVA 1.0: LTS Successor Design

An evaluation of the old static build (v2.9.7) and the design for LTS 1.0. The repository skeleton
and its governing docs are on branch `cursor/lts-successor-skeleton-9c87` of this new project's
repository.

| #   | Deliverable                                                                                                     | Where                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Old Repo Salvage Report (GREEN/YELLOW/RED)                                                                      | [salvage-report.md](salvage-report.md)                                                                                        |
| 2   | LTS 1.0 architecture                                                                                            | [architecture-proposal.md](architecture-proposal.md) (full: repo `docs/ARCHITECTURE.md`)                                      |
| 3   | Initial repo tree + responsibilities                                                                            | [repo-tree.md](repo-tree.md)                                                                                                  |
| 4   | README, Constitution, Playbook, Architecture, ADRs 0001–0008                                                    | In the repo: `README.md`, `docs/PRODUCT_CONSTITUTION.md`, `docs/DEVELOPMENT_PLAYBOOK.md`, `docs/ARCHITECTURE.md`, `docs/adr/` |
| 5   | Git setup (GitHub remote, branch workflow, tags, rollback)                                                      | [git-setup.md](git-setup.md)                                                                                                  |
| 6   | v1 vertical slice spec                                                                                          | [v1-vertical-slice.md](v1-vertical-slice.md)                                                                                  |
| 7   | Old-to-new reuse map                                                                                            | [reuse-map.md](reuse-map.md)                                                                                                  |
| 8   | Ordered build milestones M0–M8                                                                                  | [build-sequence.md](build-sequence.md)                                                                                        |
| +   | Hosting setup: Supabase (Vercel Marketplace), regions, env vars, migrations, AI Gateway, deploy, phone + laptop | [hosting-setup.md](hosting-setup.md) (short version: repo playbook, "Hosting setup")                                          |

## Decisions in one paragraph

LTS 1.0 is **one Next.js + TypeScript app** (Tailwind, shadcn/ui) on **Postgres + Auth from
Supabase**, with Drizzle migrations. It is deployed to Vercel, with Supabase provisioned through the
Vercel Marketplace. It is a single package whose folder boundaries are enforced by lint, not a
monorepo. AI runs through an LTS-owned harness with one **Vercel AI Gateway** adapter (API key
locally, OIDC when deployed) and an offline mock. The model gets a few bounded read tools and can
only return typed proposals. **All consequential domain mutations go through the same audited
mutation layer; AI-generated mutations additionally require proposal approval.** Observations
(what Lucas said) and inferences (what anyone concluded) are separate records. AI traces keep
metadata durably and raw text only when switched on, with a short retention window.

## Revisions after review (2026-10-07)

Lucas's reviewer accepted M0 as the foundation; these targeted corrections were applied on the
same branch (repo commit "Docs: mutation layer, …") and in these planning docs:

1. **Mutation layer:** one `runMutations` gateway (validate → authorize → write → change log →
   provenance, one transaction) used by both the AI-proposal path (after approval) and manual edits
   and undo.
2. **Tenancy honesty:** "multi-tenant-conscious". The server connection bypasses RLS, so a missing
   `user_id` filter could leak data; isolation tests are the mitigation, not a guarantee.
3. **AI trace privacy:** durable `harness_runs` metadata (hashes, versions, tool calls, proposal
   ids) plus a prunable `harness_run_payloads` table; `LTS_AI_TRACE_MODE` (`metadata` default) and
   `LTS_AI_TRACE_RETENTION_DAYS`.
4. **Model gateway:** Vercel AI Gateway adapter (verified: `AI_GATEWAY_API_KEY` locally; on Vercel
   the AI SDK uses `VERCEL_OIDC_TOKEN` automatically when no key is set). The mock stays. Added a
   `ProviderCapabilities` type (`toolCalling`, `structuredOutput`, `maxContextTokens`, `streaming`).
5. **Risk-language stop:** narrowed to a fixed phrase check and a fixed message pointing to human
   help; explicitly not a crisis classifier.
6. **Stack lock** from M1 (playbook + ADR README).
7. **Hosting guide** added ([hosting-setup.md](hosting-setup.md)); env names aligned to what the
   Marketplace integration syncs (`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
8. **git-setup.md:** tagging `v0.0.0` moved to a final step after local
   `pnpm install && pnpm check && pnpm build`.

## Deviations from the brief

| Brief said                                    | Did                                                                                                                                            | Why                                                                                                                                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React + TS + **Vite** suggested               | **Next.js** (React + TS)                                                                                                                       | A Vite SPA still needs a separate server for keys, the harness, and transactions. The legacy static-site + Worker split is what produced an unauthenticated endpoint with CORS `*`. One deployable is simpler (ADR 0003) |
| Consider monorepo (`apps/*`, `packages/*`)    | One package, same boundaries as `src/` folders + ESLint rules                                                                                  | Single consumer; workspaces would add config without enforcing anything lint can't (ADR 0008)                                                                                                                            |
| GitHub canonical                              | GitHub canonical **once created**; the Cursor-hosted remote is the interim home                                                                | The project starts on a Cursor-hosted repo; [git-setup.md](git-setup.md) moves the history to GitHub (ADR 0007)                                                                                                          |
| Open a draft PR to `main`                     | Branch pushed; **no PR**                                                                                                                       | The PR tool refused: this temporary repo kind doesn't support pull requests. Open the PR on GitHub after step 3 of git-setup                                                                                             |
| `record_observation` tool                     | `observation.record` **proposal kind**                                                                                                         | No model output writes directly, including observations (ADR 0005)                                                                                                                                                       |
| Provider-independent harness                  | Vercel AI Gateway adapter + mock behind one `ModelProvider` interface with a capability descriptor                                             | Lucas chose the gateway after review; the interface still allows another adapter                                                                                                                                         |
| ~14 illustrative AI tools                     | 4 read tools + `submit_proposals` in v1; `get_recent_routines` M6; `search_history`, `propose_inference`, `create_review` M7; the rest backlog | Tools exist only when their tables do                                                                                                                                                                                    |
| Inferences/operating state in the model       | Separation decided now (ADR 0006); `inferences` table lands in M7                                                                              | The slice proves the rule with grounded, user-quoted observations and a validator; inferences have no consumer before Review                                                                                             |
| Connectors, frontier vs floor                 | Backlog, with a reserved data-model shape (`links`, `focus_areas`)                                                                             | Brief says don't over-engineer in v1                                                                                                                                                                                     |
| Separate Today and Capture                    | Capture box on top of Today                                                                                                                    | One fewer screen; "say anything" starts from where you act                                                                                                                                                               |
| Habits and routines as separate domains       | Merged: a habit is a one-step routine (M6)                                                                                                     | Legacy duplicated logic across two rooms                                                                                                                                                                                 |
| Routine variants full/compressed/emergency    | full/**short**/**minimum**                                                                                                                     | Same idea, without alarm language (Article 4)                                                                                                                                                                            |
| License placeholder                           | A decision: all rights reserved for now                                                                                                        | Personal-life data models; easy to relax later, hard to retract                                                                                                                                                          |
| Issue/backlog strategy                        | GitHub Issues (`backlog` label) + an interim `docs/BACKLOG.md`                                                                                 | No GitHub repo yet                                                                                                                                                                                                       |
| Legacy "don't name the AI provider in the UI" | Provenance shows the model id; the provider stays in config                                                                                    | Provenance matters more than branding; it isn't a product principle                                                                                                                                                      |
| Docs in the repo                              | Deliverables 4 + skeleton in the repo; 1, 2, 3, 5, 6, 7, 8 here in the Project docs                                                            | Per assignment; the repo keeps only files that have a job going forward (`LEGACY.md` summarizes provenance)                                                                                                              |
