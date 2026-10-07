# 0005. AI uses bounded LTS tools and returns proposals; no raw DB access

Status: Accepted
Date: 2026-10-07

## Context

Models are useful for interpretation and dangerous as writers: they hallucinate dates, over-read
emotion, and can be prompt-injected through captured text. The legacy Worker returned JSON that
the frontend validated, which was the right instinct, but nothing bounded what context it could
see or how decisions were applied (Review decisions were applied by substring-matching free text).

## Decision

- The harness exposes a small allowlist of typed tools implemented by LTS, scoped to the current
  user, with row/time limits and sensitivity gates. No SQL, no generic query tool.
- The model returns changes only through `submit_proposals`, validated by the same zod contracts as
  the UI. Proposals are written to `proposal_items`; domain tables are written only by the approval
  transaction after user approval.
- Providers sit behind one interface; v1 ships an OpenAI-compatible HTTP adapter and an offline mock.

## Consequences

- Every model action is auditable (`harness_runs`) and reversible (`change_log`).
- Some "smart" behaviors need a new tool before they are possible; that friction is intentional.
- Switching providers is configuration, not code.
