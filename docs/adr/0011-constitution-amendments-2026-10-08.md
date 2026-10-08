# 0011. Constitution amendments of 2026-10-08 and document precedence

Status: Accepted
Date: 2026-10-08

## Context

The constitution says amending an article requires an ADR. Lucas decided on 2026-10-08 that the
governing docs must reflect what he actually decided, and that agents must not be told to violate the
constitution, so the constitution is amended before anything else follows.

What the evidence supports, from [the conversation history comparison](../history/LTS_conversation_history_vs_current_repo.md):
the earliest rules were "No Data is not the same thing as Missed", partial completion, intentional
skip, recovery, and "AI should suggest rather than silently control"; explicit 1-10 scales for
capacity, mood, stress, and energy were once defined, with a warning that they are subjective; and
the Life Tracker OS era added the connections between rooms. Habits later "moved away from generic
streak tracking". The history doc does not say Lucas used streaks in the app he lived in; whether
he did is not documented there. A separate review of the earliest React prototype (Legacy B, project
notes, not in this repo) found a current and longest streak and a compliance percentage, together
with defects: UTC date keys and an unticked day painted as a red miss. The streak decision below is
Lucas's, and its semantics are written to avoid exactly those defects.

Several current docs go further than the history supports. They ban streaks and scores outright
(the constitution's Article 4, `docs/UI.md`, `AGENTS.md`, the playbook) and say AI-generated
mutations additionally need proposal approval (the invariant line in ADR 0005 and in the
`docs/planning/` copies). The constitution and `docs/ARCHITECTURE.md` already allowed explicit
low-risk commands to run directly, so the remaining conflict is that one line.

This is not a stack change. Next.js, Supabase, Drizzle, Tailwind/shadcn, zod, Vitest, Vercel, and the
proposal/mutation architecture are unchanged.

## Decision

1. **The amendments** are the "Amendments (Lucas, 2026-10-08)" section of
   [`PRODUCT_CONSTITUTION.md`](../PRODUCT_CONSTITUTION.md), with Articles 2, 3, 4, 5, 7, 8, and 11 and
   the health boundaries updated to match: historical priority; streaks as factual continuity
   metrics with defined semantics; user-reported numeric scales; direct low-risk AI execution under
   an allowlist and user-granted authority, plus the health and nutrition boundary; and welcome for
   dense functionality. That section is the text. This ADR does not restate it.
2. **ADR 0005's invariant is reworded.** "AI-generated mutations additionally require proposal
   approval" becomes: AI-originated mutations either run directly under the allowlist and the user's
   granted authority, or require proposal approval. Everything outside the allowlist still needs
   approval. The mutation layer, bounded tools, and provenance requirements are unchanged.
3. **Precedence.** When documents disagree, the higher one wins and the lower one is fixed:
   1. `PRODUCT_CONSTITUTION.md`, as amended;
   2. ADRs in `docs/adr/`;
   3. `AGENTS.md`, together with the working docs it indexes (`ARCHITECTURE.md`,
      `DEVELOPMENT_PLAYBOOK.md`, `UI.md`, `LEGACY_PARITY.md`, `MODULE_PARITY.md`, `STATUS.md`),
      which must agree with 1 and 2;
   4. `docs/planning/`, which is historical background.

   `docs/history/` and `docs/MODULE_PARITY.md` are the product-intent references: they say what
   Lucas used and intended, and they do not override 1 to 3. The earlier design-plan decisions
   (kept outside the repo; `docs/UI.md` records what the code does today) still apply wherever they
   do not conflict with the amendments.

4. **Planning copies get a note, not a rewrite.** `docs/planning/` documents that say "no streaks" or
   "no scores", or that AI mutations always need approval, carry a short note at the top saying the
   amendment overrides.

## Consequences

- Agents can build streaks, labeled self-reported scales, and allowlisted direct AI execution
  without breaking the constitution. They still may not build shame copy, red miss badges, inferred
  scores or day modes, or silent sensitive writes.
- Code that encodes the old rule needs a deliberate change when the relevant room is built, not
  before. Known cases: the copy guardrail tests in `src/components/today/model.test.tsx` and
  `src/components/life/RoutineRunner.test.tsx` match words such as "streak" and "score", and must
  become checks for guilt copy and red miss styling instead of a ban on the word. The prompt rule in
  `src/ai/prompts/interpret.ts` ("turn feelings into scores") stays correct: the system still never
  converts words to numbers.
- The Settings allowlist and a recorded way to tell a direct execution from a confirmed proposal
  are not built. Today the only direct execution is `Add task: …` under the "allow explicit"
  setting (`applyAllowedExplicitTask`, which records it as a proposal-origin change), and History
  can undo only the latest change to a given record. The allowlist must not widen until each new
  direct execution has a verified undo path.
- Revisit if a direct execution ever changes something Lucas did not state, or a streak display
  produces guilt in real use. Either one is evidence for a new ADR.
