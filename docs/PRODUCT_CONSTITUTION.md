# LTS Product Constitution

These articles decide arguments. When a feature, prompt, or schema conflicts with one of them, the
article wins and the feature changes. Amending an article requires an ADR.

**One line:** LTS turns messy real life into structure that changes what Lucas understands,
decides, or does next. AI interprets and proposes. The user governs.

## Articles

1. **A tracker must improve understanding, decision, or action.** Every tracked field must feed a
   screen, a review, or a proposal. If nothing reads it, stop collecting it.
2. **AI proposes; the user decides.** Models produce proposals, explanations, and questions. They
   never write domain state. All consequential domain mutations go through the same audited
   mutation layer; AI-generated mutations additionally require the user's approval of the proposal.
3. **Observation is not inference.** What the user said, logged, or a device measured is an
   _observation_. What anyone (AI or rule) concluded from it is an _inference_. They live in
   different tables, render differently, and an inference never becomes an observation without the
   user explicitly restating it.
4. **Misses create recovery paths, not shame loops.** A missed routine produces a smaller next step
   (minimum version, reschedule, park), never a broken-streak penalty, red score, or guilt copy.
5. **Complexity must pay rent.** A new room, setting, field, or abstraction needs a real day where its
   absence hurt. Otherwise it goes to the backlog.
6. **Manual override stays available.** Anything AI can propose, the user can create, edit, or delete
   directly, without AI.
7. **Track only what can matter.** Prefer fewer surfaces over typed data. Not every domain needs a UI
   in v1.
8. **Reality beats aesthetics.** A plain screen that matches what happened beats a beautiful one that
   implies precision LTS does not have. No pseudo-precise life scores.
9. **No silent mutation of consequential state.** Schedule, commitments, health-adjacent data, and
   settings change only through an approved proposal or a direct user edit. Both paths run through
   the same mutation layer, so every change is validated, authorized, atomic, and in the change log
   with before/after and its origin. Narrow automations are allowed only when the user deliberately
   configured that exact automation, and they use the same layer.
10. **Ship before redesigning.** LTS 1.0 gets finished even if we become smarter while building it.
11. **New ideas go to the backlog** unless they solve a demonstrated blocker for the current milestone.

## Health and safety boundaries

Capacity, sleep, food, fitness, and mood data are sensitive.

LTS **may**: summarize, organize, surface patterns with their evidence, ask grounding questions, and
propose behavioral or logistical actions (move a block, use a routine's minimum version, protect a
meal window).

LTS **must not**:

- diagnose, name conditions, or prescribe or adjust medication;
- present uncertain psychological interpretations as fact, or assign identity/personality labels;
- silently create or change health-adjacent records (all such writes need approval, Article 9);
- encourage obsessive self-surveillance (no prompts to log more than the user chose);
- produce shame-based copy (Article 4).

**Risk-language stop.** If a capture contains explicit harm language from a small, fixed phrase
list, LTS makes no AI call and no proposals, and shows a fixed message pointing to human help. This
is deliberately narrow and conservative. It is **not** a crisis classifier: it does not score,
infer, or monitor risk, and it will miss indirect language. LTS must never claim otherwise.

Access to sensitive categories by AI tools is opt-in per category and logged.

## Operating state, not personality

LTS may track provisional, evidence-backed **operating-state variables** (load, recovery need,
routine reliability, capacity, active frontier, primary friction). Each value cites the observations
it came from, is editable, and expires. LTS never assigns modes like "Burned by Sun" or
"Survival Day" as identities.

## Frontier and floor

- **Floor**: the few things that must stay stable (sleep window, meals, meds readiness, work/school
  obligations). Protected first when capacity drops.
- **Frontier**: the current expansion edge (ship LTS 1.0, fitness consistency, finish the semester).
  At most three active at once.
