# 0005. AI uses bounded tools and proposals; all domain writes go through one mutation layer

Status: Accepted (revised 2026-10-07 after review: mutation layer, AI Gateway, trace retention; invariant reworded 2026-10-08 by [ADR 0011](0011-constitution-amendments-2026-10-08.md))
Date: 2026-10-07

## Context

Models are useful for interpretation and dangerous as writers: they hallucinate dates, over-read
emotion, and can be prompt-injected through captured text. The legacy Worker returned JSON that
the frontend validated, which was the right instinct, but nothing bounded what context it could
see or how decisions were applied (Review decisions were applied by substring-matching free text).
Manual edits in the legacy build took yet another path, so audit and rollback behaved differently
depending on who made the change.

## Decision

- **One mutation layer.** `runMutations(ctx, commands)` in `src/server/mutations/` is the only code
  that writes domain tables. It validates, authorizes (rows must belong to `ctx.userId`), writes,
  records `change_log` and provenance, and does it all in one transaction. Both paths use it:
  AI/parser proposal → user approval → mutation layer, and direct manual action → mutation layer.
- **Invariant:** all consequential domain mutations go through the same audited mutation layer.
  AI-originated mutations either run directly, only when the command is on the user-configured
  allowlist of explicit low-risk commands and the user has granted that authority in Settings, or
  require proposal approval. Everything else (sensitive or health data, deletions and archives,
  inferred or ambiguous changes, bulk changes) requires proposal approval. A direct execution is
  validated, logged with provenance, shown in History, and undoable like any other change
  (Constitution, Amendment 4).
  _Before 2026-10-08 this line read: "AI-generated mutations additionally require proposal
  approval."_
- **Bounded tools.** The harness exposes a small allowlist of typed read tools implemented by LTS,
  scoped to the current user, with row/time limits and sensitivity gates. No SQL, no generic query
  tool. The model returns changes only through `submit_proposals`, validated by the same zod
  contracts as the UI and stored in `proposal_items`.
- **Model gateway.** The production adapter targets the **Vercel AI Gateway** via the AI SDK. It
  authenticates with `AI_GATEWAY_API_KEY` locally and with the Vercel project's OIDC token when
  deployed on Vercel (no long-lived key in production). An offline `mock` adapter stays the default
  for development, tests, and CI. Behind the gateway, changing the model is configuration
  (`LTS_AI_MODEL`); a different gateway would be a new adapter, not a harness change.
- **Capabilities, not assumptions.** Each adapter reports a `ProviderCapabilities` descriptor
  (`toolCalling`, `structuredOutput`, `maxContextTokens`, `streaming`). The harness branches on it;
  business logic never assumes every model behaves the same. This is a type plus a static table,
  not a capability system.
- **Minimal traces.** `harness_runs` keeps metadata, tool calls, proposal ids, hashes, and versions
  durably; raw prompt/output text lives in a separate prunable table and is off by default
  (`LTS_AI_TRACE_MODE=metadata`).

## Consequences

- Every change, whoever made it, is validated, authorized, atomic, auditable (`change_log`), and
  undoable the same way.
- Some "smart" behaviors need a new tool or command before they are possible; that friction is
  intentional.
- Model choice and fallback routing are configuration in the gateway; the gateway is a dependency
  (its availability and pricing), mitigated by the parser fallback and the mock adapter.
- Debugging an old AI run without raw text relies on hashes, tool-call metadata, and
  `original_payload`. Switch to `full` trace mode temporarily when a bug needs the text.
