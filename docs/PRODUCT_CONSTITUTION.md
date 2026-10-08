# LTS Product Constitution

These articles decide arguments. When a feature, prompt, or schema conflicts with one of them, the
article wins and the feature changes. Amending an article requires an ADR. The amendments Lucas
made on 2026-10-08 are listed at the end of this document and recorded in
[ADR 0011](adr/0011-constitution-amendments-2026-10-08.md); the articles below already include
their effect.

**One line:** LTS turns messy real life into structure that changes what Lucas understands,
decides, or does next. AI interprets within authority the user grants; the user governs.

## Articles

1. **A tracker must improve understanding, decision, or action.** Every tracked field must feed a
   screen, a review, or a proposal. If nothing reads it, stop collecting it.
2. **The user grants authority; LTS stays within it.** Explicit, low-risk commands on the allowlist
   may execute directly when the user's permission setting allows them (Amendment 4). Autonomous or
   interpretive changes and high-impact actions ask first. All consequential domain mutations go
   through the same audited mutation layer; the model never receives unrestricted database access.
3. **Observation is not inference.** What the user said, logged, or a device measured is an
   _observation_. What anyone (AI or rule) concluded from it is an _inference_. They live in
   different tables, render differently, and an inference never becomes an observation without the
   user explicitly restating it. A number the user reports about their own state is an observation
   (Amendment 3); a number LTS derives from his words is not.
4. **Misses create recovery paths, not shame loops.** A missed routine produces a smaller next step
   (minimum version, reschedule, park), never a red miss badge, a red score, or guilt copy. Streaks
   are allowed as factual continuity metrics under Amendment 2, never as moral scores.
5. **Complexity must pay rent.** A new room, setting, field, or abstraction needs a real day where its
   absence hurt. Behavior Lucas actually used in earlier LTS versions has already paid that rent
   (Amendment 1). Otherwise it goes to the backlog.
6. **Manual override stays available.** Anything AI can propose, the user can create, edit, or delete
   directly, without AI.
7. **Track only what can matter.** Every field should serve a use. Dense functionality, metrics, and
   history are welcome where they serve use (Amendment 5); do not flatten the app into a minimal one
   to look simple, and do not add surfaces nobody reads.
8. **Reality beats aesthetics.** A plain screen that matches what happened beats a beautiful one that
   implies precision LTS does not have. No pseudo-precise or composite life scores, and nothing
   computed from words. Numbers the user reports about themselves are allowed under Amendment 3.
9. **Consequential changes are governed and recoverable.** Schedule, commitments, health-adjacent
   data, and settings change through an authorized direct command, a confirmed proposal, or a direct
   user edit. Every path runs through the same mutation layer, so each change is validated,
   authorized, atomic, and recorded with before/after and origin. High-impact or destructive changes
   require confirmation. Narrow automations require deliberate configuration and use the same layer.
10. **Ship before redesigning.** LTS 1.0 gets finished even if we become smarter while building it.
11. **Legacy capability is product evidence.** Check `docs/LEGACY_PARITY.md`,
    `docs/MODULE_PARITY.md`, and `docs/history/` before substantial feature work. Restore useful
    behavior on the current foundation; discard unsafe behavior and bad implementation structure.
    New ideas outside the parity target go to the backlog.

## Health and safety boundaries

Capacity, sleep, food, fitness, and mood data are sensitive.

LTS **may**: summarize, organize, surface patterns with their evidence, ask grounding questions, and
propose behavioral or logistical actions (move a block, use a routine's minimum version, protect a
meal window).

LTS **must not**:

- diagnose, name conditions, or prescribe or adjust medication;
- present uncertain psychological interpretations as fact, or assign identity/personality labels;
- infer or fabricate health-adjacent records; only user-stated or measured observations may be
  recorded, and sensitive or consequential changes require confirmation (Article 9);
- encourage obsessive self-surveillance (no prompts to log more than the user chose);
- produce shame-based copy (Article 4);
- prescribe intake, or give medical or rehab advice (Amendment 4).

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

## Amendments (Lucas, 2026-10-08)

Lucas decided that the governing docs must match what he actually decided, and that agents must not
be told to violate the constitution, so the constitution changes first. This list is explicit and
dated. The articles above are updated to match, and the constitution still binds: where this list
is silent, the articles apply. The reasoning is in
[ADR 0011](adr/0011-constitution-amendments-2026-10-08.md).

### 1. Historical priority

Keep the behavior Lucas actually used (early LTS), add the connections from the Life Tracker OS
era, and build both on the current engineering foundation. Where historical versions conflict,
prefer the functionality he used and valued, unless there is a concrete technical or safety problem.
Later philosophy refines earlier behavior; it does not erase it. Whatever a historical version did
that only a safety or engineering problem argues against is changed or dropped with that reason
written down, not silently.

### 2. Streaks are allowed, as facts

Streaks and similar continuity counts are wanted. They are factual continuity metrics, never moral
scores. Semantics:

- A streak evaluates only occurrences that were scheduled or due. "No entry" is not "missed".
- The states of a due occurrence are: **completed**, **minimum completed**, **partial**, **skipped
  intentionally**, **missed**, and **no data**.
- A day on which the habit is not due does not affect the streak.
- An intentional skip does not break the streak.
- Minimum completed counts as completion when the habit defines it that way.
- No data never becomes missed on its own. A due day with no entry shows a neutral "no data", not a
  red miss.
- Only an explicit miss breaks a streak. A miss is something the user recorded or confirmed.
- Local date keys are authoritative: the user's timezone decides which day an entry belongs to.
  Never derive a day from `toISOString().slice(0, 10)` or any other UTC conversion.
- Weekly and frequency habits use their actual recurrence rules (for example "3 times a week"),
  not a daily rule.
- Not yet decided by Lucas: how `partial` counts. Until he decides, a partial neither extends nor
  breaks a streak, and the Habits spec must ask.

Article 4 stands: misses create recovery paths, not shame loops. No red miss badges, no guilt copy,
no "streak lost" language. A streak is shown as a plain fact (a current run, a best run) and an
ended streak is shown the same way.

### 3. Self-reported numbers

User-reported numeric scales (mood, energy, stress, capacity, and similar) are allowed alongside
free text, when they are clearly labeled as subjective and self-reported. The system:

- never converts words into numbers;
- never infers a score, or a day mode, from text;
- never presents a self-reported number as objective truth or as a diagnosis;
- keeps the number as an observation (Article 3): it is the user's, quoted and dated.

Article 8 still forbids pseudo-precise composite life scores. A scale the user fills in is a
report, not a life score.

### 4. Direct low-risk AI execution, and the health boundary

**Execution.** Explicit, low-risk AI commands may run without a per-item proposal when both are
true: the command is on an allowlist, and the user has granted authority for it in Settings. The
allowlist starts narrow, for example: add a task, add a grocery item, log a clearly stated entry.
Never auto-execute:

- health or other sensitive data;
- deletions or archives;
- anything inferred rather than stated;
- anything ambiguous;
- bulk changes.

Every direct execution goes through the mutation layer, is recorded with provenance, shows in
History, and can be undone. Higher-impact or autonomous actions still ask first (Articles 2 and 9).
This amends the earlier wording that AI-generated mutations always require proposal approval:
proposal approval is now required for everything outside the allowlist. See
[ADR 0005](adr/0005-ai-tools-not-raw-db-access.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

**Health and nutrition.** TDEE, calorie targets, bodyweight goals, and similar numbers are
estimates the user entered, labeled as his choices. LTS does not pretend it prescribed them and does
not prescribe intake. Injury-aware exercise substitutions that Lucas chose can be tracked. LTS gives
no medical or rehab advice.

### 5. Density is welcome

Dense functionality, metrics, and history are welcome where they serve use. A room may be rich. The
test is Article 1 (does it change what Lucas understands, decides, or does), not minimalism.
