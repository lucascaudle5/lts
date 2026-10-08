# Life Tracker Suite — Conversation History vs. Current GitHub Repo

**Prepared:** October 8, 2026  
**Current repo reviewed:** `lucascaudle5/lts` on GitHub, default branch `main`  
**Historical basis:** prior LTS/NOVA conversations, especially the **“NOVA Fragment Kanye West”** development thread and adjacent June 2026 LTS design conversations.  
**Scope:** the historical side is conversation-derived intent, not a reread of the legacy ZIP implementation.

## Executive summary

The current GitHub LTS is not a conceptual break from older versions so much as a technical re-foundation of many of the same product ideas.

The current repo already has working surfaces for Today, Schedule, Tasks / Assignments, Habits, Routines, Fitness, Food / Diet, Sleep & state / Mind, Projects, Money, Review, History, Archive, Sandbox, Inbox/capture, and Settings.

That is close to the mature room set from the older conversations. The important difference is not primarily **which tabs exist**; it is **how the tabs relate to one another**.

The older conversational vision increasingly became a connected life operating system:

- **Schedule** was the “basement floor” / time foundation.
- **Today** was the front desk / execution surface.
- **Review** was the control room / governance surface.
- Rooms remained useful alone but emitted signals to other system layers.
- **Routines** acted as a bridge across domains.
- **Mind / Capacity** helped answer how much the day could realistically carry.
- **NOVA** explained, interpreted, suggested, and prepared changes.
- **Archive** held old or parked material instead of erasing it.
- **Settings / Rules** constrained what the system was allowed to do.

The current repo preserves much of the functionality, but currently feels more like a **typed workspace with robust room pages** than the fully interconnected OS described in those conversations.

> **Current LTS has stronger engineering integrity and broad feature parity. Older LTS had a richer cross-room behavioral model and stronger operating-system identity.**

The best direction is not to return to the legacy architecture. It is to keep the current repo and deliberately restore the strongest conversation-derived behaviors that have not yet become first-class product behavior.

---

# Historical evolution

## Phase A — Practical tracker

The earliest Life Tracker concept was practical rather than philosophical. Recurring modules included:

- Assignments / school
- Habits
- Mental Health
- Fitness
- Schedule / Planner
- Diet / Macros
- Work shifts
- Money / Work
- Daily logging
- History / Stats
- Weekly Review

The interaction model was conventional: tables, calendar views, lists, inline editing, filters, status/urgency cues, CRUD, delete confirmation, optional notes, and trend/history views.

Important early rules already existed:

- **No Data is not the same thing as Missed.**
- Partial completion matters.
- Intentional skip matters.
- Recovery matters.
- A tracker is useful only when it changes action.
- AI should suggest rather than silently control.
- Tracking should not become shame machinery.

## Phase B — Today becomes “king”

A major change happened when LTS stopped being treated as a set of separate trackers and became a system centered on **Today**.

The recurring design became:

> **Today is where the user lives. The modules exist partly to make Today smarter.**

Today was intended to answer:

- What do I need to do?
- What is fixed?
- What is due?
- What is the floor?
- What is the next physical action?
- What did I miss?
- What is recoverable?
- What should be ignored for now?

## Phase C — Room-based Life Tracker OS

The suite became a set of rooms/apps with explicit roles:

- **Today** — front desk / execution
- **Schedule** — basement / time foundation
- **Capture** — raw input
- **Assignments** — deadlines / school work
- **Habits** — floor behaviors
- **Routines** — bundled actions
- **Mind / Capacity** — how much the day can carry
- **Fitness** — training
- **Diet** — fuel / meals
- **Review** — control room / governance
- **Archive** — memory / parked material
- **Settings / Rules** — constraints
- **NOVA** — analyst / interpreter / command layer

The user explicitly wanted each room to remain useful alone while becoming more useful when connected.

The clearest architecture was:

> **Rooms create signals → Schedule receives time/protection/recovery implications → Today prioritizes → Review governs → NOVA explains/suggests.**

## Phase D — “NOVA Fragment Kanye West” build era

The Kanye fragment thread became the largest practical LTS development thread, spanning many generated builds and increasingly specific room contracts.

Important product laws in that period included:

- nothing consequential changes invisibly
- clarify instead of guessing
- raw Capture should be a fallback, not where everything gets dumped
- use plain English
- the user should not need to become good at prompting
- NOVA is an interpreter/tool, not final authority
- Review should turn patterns into decisions
- misses should lead to recovery, not punishment

This era deepened:

- room contracts
- signals
- capacity-aware behavior
- full / compressed / emergency routines, later improved to full / short / minimum
- fillable missing slots
- approval previews
- sandbox behavior
- cross-room governance

---

# Room-by-room comparison

## Today / Home

### Older conversational intent

Today was repeatedly described as the **front desk**, **execution surface**, and primary screen. It was supposed to surface the few things that actually matter now, not dump the whole database on the user.

Depending on context it could prioritize:

- fixed obligations
- urgent deadlines
- floor habits
- meals
- routines
- recovery actions
- study next actions
- project next actions
- protected build time
- upcoming blocks
- only a few load-bearing actions when overloaded

The key question was:

> **What should I do now?**

### Current repo

Current Today is one of the strongest current screens. It includes a time-aware greeting, capture hero, **Up next**, current/next schedule, floor checklist, “Do the small version,” due/open work, room-derived items, recent changes, and empty/open/heavy/done day states.

### Judgment

**Mostly preserved.** Current Today is strong. The historical difference is that Today was meant to be even more explicitly governed by capacity, room signals, Review decisions, active season, and overload state.

---

## Schedule

### Older conversational intent

This was one of the clearest ideas:

> **Schedule is the basement floor.**

It was not supposed to be just another calendar tab. Other rooms could ask time-related things of Schedule:

- Assignments request study time.
- Fitness requests training time.
- Diet requests meal protection.
- Habits request anchors/protection.
- Routines occupy time.
- Mind / Capacity warns against extra load.
- Review can approve schedule repair.
- Work/classes define fixed constraints.

The user explicitly wanted the **cross-tab connection system** to matter more than superficial toolbar naming.

### Current repo

Current Schedule supports day/week/month navigation, fixed and movable commitments, occurrence edits, bounded recurrence, series archive, overlap confirmation, typed bulk import, and links from other records.

### Judgment

**Functional parity is strong; OS integration is weaker.** The older Schedule was not just where blocks lived; it was where competing demands on time were reconciled.

---

## Tasks / Assignments / School

### Older conversational intent

Assignments were an early concrete tab with common fields and behaviors:

- class/course
- assignment name
- due date
- Not Started / In Progress / Done
- overdue handling
- priority
- filters
- inline editing
- exams/projects
- study planning

Later, Assignments connected to Schedule for study blocks, Today for next actions, Review for missed-assignment recovery, and Mind / Capacity for realistic study load.

### Current repo

Current Tasks / Assignments include create/edit, kind, due date, priority, status, overdue filtering, estimate, next step, blocker, project linking, subtasks, timer/logged sessions, completion, parking, and archive.

### Judgment

**Current raw capability is richer**, but the old experience was more explicitly school-oriented. Course/exam/study-block behavior can still be made more purpose-built without changing the task architecture.

---

## Habits

### Older conversational intent

Habits became a carefully defined room. The user moved away from generic streak tracking.

Important distinctions included:

- floor
- optional
- anchored
- routine-linked / routine-step

Completion/recovery language included ideas such as:

- Done
- Minimum done
- Skipped intentionally
- Missed
- Recovered
- Not applicable

The priority model was:

> **critical floor → floor → routine/recovery → optional**

On low-capacity days, optional habits should disappear before the floor.

NOVA could suggest reducing load, changing anchors/frequency, turning a habit into a routine, or creating a minimum version—but never shame, force streaks, or mark completion itself.

### Current repo

Current Habits support floor/optional, cue/anchor, check/count/minutes, minimum target, scheduled days, daily logs, done/partial/skipped, and weekly counts.

### Judgment

**Core philosophy is preserved.** Historical lifecycle/recovery richness was broader, especially recovered/not-applicable states and explicit capacity-aware visibility.

---

## Routines

### Older conversational intent

Routines became the first true **bridge room**, intended to connect Schedule, Today, Habits, Work, Fitness, Diet, and Mind / Capacity.

Key behaviors included:

- full / compressed / emergency, later full / short / minimum
- create/edit
- per-variant steps
- duplicate
- archive/restore
- Schedule placement
- run modal
- step checkoff
- complete / partial / intentional skip
- run history
- Today launch

A major principle was:

> **The minimum version still counts when the routine is explicitly designed that way.**

### Current repo

Current Routines support full/short/minimum variants, anchors, scheduled days, checklist runs, partial/skip, minimum completion counting, and Today integration. Current design work treats Routines as an exemplar room.

### Judgment

**Excellent preservation.** The main remaining opportunity is cross-domain advisor behavior: work-shift routines, study sprints, meal prep, gym routines, and capacity-driven compression.

---

## Mind / Capacity / Sleep & State

### Older conversational intent

The purpose was stated directly:

> **Mind / Capacity helps LTS understand how much the day can carry.**

It was not supposed to diagnose. It was supposed to help answer:

- How much capacity is available today?
- What is the emotional/weather state?
- Is stress high enough to change the plan?
- Is sleep/energy low enough to compress routines?
- Should Today show a full, reduced, or recovery plan?
- Should Schedule avoid adding more load?
- What patterns should Review revisit?

At one point explicit 1–10 scales were defined for capacity, mood, stress, and energy, while still warning that those numbers were subjective rather than objective truth.

### Current repo

Current **Sleep & state** records sleep hours/start/end, energy/mood/stress in the user’s words, “what feels manageable today?”, state notes, and quoted observations. The repo deliberately avoids invented scores and labels.

### Judgment

**Current data philosophy is better.** The old version had stronger operational influence on Today/Schedule. The best synthesis is subjective observation + optional planning suggestions, not pseudo-objective scoring.

---

## Fitness

### Older conversational intent

Fitness was always supposed to stand alone as a useful tracker while also connecting to the rest of the system.

Desired capability included workouts, exercises, bodyweight, strength progress, cardio, substitutions, injury-aware replacements, training consistency, schedule connection, and recovery/capacity awareness.

Later cross-room reasoning emphasized training consistency, fuel timing, recovery mismatch, and capacity vs. workout load.

### Current repo

Current Fitness supports split/session plans, exercise library, substitutions, sets/reps/load, RPE notes, workout outcomes, bodyweight, next session, protected schedule links, and minimum/substitution notes.

### Judgment

**Strong standalone room.** The historical gap is cross-domain interpretation rather than missing workout features.

---

## Diet / Food

### Older conversational intent

The Diet room was intended to include food library, meal entries/templates, favorites, quick logging, macro targets, TDEE planning/profile, daily summaries, and realistic adherence.

It was also supposed to connect to Schedule for meal protection, Today for meals that matter now, Fitness for fuel timing, Review for repeated misses, and Routines for meal-prep chains.

### Current repo

Current Food & Meals includes a food library, favorites, serving descriptions, calories/macros where known, repeated meal templates, meal logs, meal windows, and nutrition targets. Unknown measurements stay unknown.

### Judgment

**Functional parity is good.** Meal protection, TDEE-style planning, and deeper Fitness/Diet/Review integration are less central than the historical concept.

---

## Projects

### Older conversational intent

Projects represented the Builder/creation side of LTS: artifacts, next actions, schedule blocks, Review visibility, Archive/parking, over-scoping, and converting repeated work into routines/templates.

The later Frontier concept emphasized only a small number of active expansion edges at once.

### Current repo

Current Projects include active/parked/done, next action, due date, up to three active frontiers, task links, and Today visibility.

### Judgment

**Good conceptual compression.** Current Projects retain the most useful old ideas without excessive project-management complexity.

---

## Money / Work

### Older conversational intent

Money/Work stayed in the suite because LTS was supposed to manage practical reality: income, work schedule, bills, immediate cash needs, debt, upcoming obligations, and practical next steps. Work Schedule was sometimes a separate concern and sometimes folded into Schedule.

### Current repo

Current Money supports income, expenses, bills, currency-separated totals, due obligations, paid status, and recurring weekly/monthly bills. Work time primarily belongs in Schedule rather than a separate Work room.

### Judgment

**Current structure is cleaner.** Debt/cash-flow pressure may deserve more specialized behavior later if actual use shows that need.

---

## Review

### Older conversational intent

Review became the **control room / governance surface**.

It was intended to ask:

- What changed?
- What worked?
- What failed repeatedly?
- What is overloaded?
- What needs protection?
- What should be parked?
- What should be pushed?

Review was supposed to govern proposed changes across Schedule, Routines, Habits, Mind / Capacity, Diet, Fitness, Assignments, Capture, Settings / Rules, and Archive.

NOVA could prepare advisor cards for routine simplification, habit reduction, schedule repair, low-capacity planning, study placement, meal protection, fitness replanning, stale-item archive, and season changes. The user should still be able to approve/edit/dismiss.

### Current repo

Current Review uses day/week/season evidence, recovery controls, decisions/next steps, deterministic evidence, and user decisions rather than model-derived mental-state claims.

### Judgment

**This is one of the largest remaining conceptual gaps.** The old Review was not merely “review the past”; it was **review the system and decide how the system should change**.

---

## History / Archive

### Older conversational intent

Archive was where old, completed, paused, parked, or stale things went without disappearing. Preservation was preferred over silent deletion. History mattered for trends, state, habits, decisions, and Review evidence.

### Current repo

Current LTS separates **History** (audit/change/provenance) from **Archive** (records removed from operational views but retained in history/export).

### Judgment

**Current version improves the original concept.**

---

## Settings / Rules

### Older conversational intent

Settings evolved from a generic settings page into the idea that:

> **Settings / Rules are user constraints.**

They could govern NOVA authority, visibility/depth, routine behavior, schedule constraints, privacy, signals, and approval expectations. There was also explicit concern that Settings had previously become a dumping ground.

Later depth concepts included Simple, Guided, Builder, Operator, and Developer, with the rule that simple users should not be overwhelmed and power users should not hit artificial walls.

### Current repo

Current Settings includes appearance/theme and system/account configuration, while authority/risk behavior exists more strongly in architecture than as a mature user-facing Rules room.

### Judgment

**Cleaner but narrower.** A first-class Rules/permissions behavior layer remains a valid historical target if it solves real use cases.

---

## NOVA / Capture / Inbox / Command

### Older conversational intent

NOVA evolved from a separate advisor idea toward a **command/interpreter layer**.

The user wanted normal language, messy input, minimal prompting skill, clarification instead of guessing, explanation of what LTS thinks the input means, routing one message into multiple rooms, and clear approval when appropriate.

At one point the Life Tracker OS direction imagined NOVA as a **bottom-left search/command launcher**, more like an OS command palette than a normal tab.

The later life-compiler interaction became:

> **messy input → structured objects → missing confirmations → review → commit**

### Current repo

Current NOVA/capture infrastructure is technically much stronger: provider abstraction, deterministic fallback parser, typed proposals, missing slots, provenance, exact source quotes, bounded tools, validation, authority/risk distinctions, Gateway AI, and sandbox/demo behavior.

### Judgment

**Current intelligence architecture is superior.** The main historical UX idea worth restoring is making NOVA feel available across the whole system rather than centered mainly around Today/capture.

---

## Sandbox

### Older conversational intent

Sandbox was imagined as a separate workspace to try schedule/routine/planning changes without touching live state.

### Current repo

Current LTS has Sandbox, a public demo, browser-memory-only demo changes, imports/exports, and separate development/production environments.

### Judgment

**Strong preservation and improvement.**

---

## Boundary Map / personalization

### Older conversational intent

Boundary Map was a later personalization concept intended to answer where life is stable/overloaded, what the active frontier is, which connectors matter, how much system depth should be visible, what Today should prioritize, and what Review should revisit.

It was explicitly not supposed to become MBTI, diagnosis, destiny, or worth ranking. Later reflection suggested that named modes risked becoming identity labels and that state variables would be safer.

### Current repo

Boundary Map is not a first-class current room. Useful descendants remain: active frontiers, floor concepts, state notes, heavy-day logic, room grouping, and settings/themes.

### Judgment

**Probably fine to postpone.** Preserve the useful descendants rather than rushing to restore the classifier-like layer.

---

# Cross-room architecture: then vs. now

## Older conversation model

```text
Room produces state / signal
        ↓
Schedule reconciles time
        ↓
Today decides what deserves attention
        ↓
User acts
        ↓
History records reality
        ↓
Review evaluates the system
        ↓
NOVA explains / suggests changes
        ↓
User approves
        ↓
Settings / Rules constrain future behavior
```

This model gave LTS a strong sense of being one integrated machine.

## Current repo model

```text
Typed room data
      ↓
Repositories / workspace
      ↓
Today + individual room UIs

Capture
  ↓
Parser / AI harness
  ↓
Typed commands / proposals
  ↓
Validation + authority
  ↓
Mutation layer
  ↓
Database + change log + provenance
```

This is much stronger technically, but primarily a **data-and-command architecture**. The older model was more explicitly a **life-governance architecture**.

The obvious synthesis is:

> **Keep the current command/data architecture and reintroduce the old signal/governance model on top of it.**

---

# Where the current repo is clearly better

1. **Canonical source of truth** — GitHub now carries the project state.
2. **Real persistence** — Postgres/Supabase replaced localStorage as canonical life storage.
3. **Provenance** — the system can answer where changes came from.
4. **Typed mutation layer** — writes pass through validated pathways.
5. **Bounded AI** — the model uses tools/typed outputs rather than raw database control.
6. **Observation vs inference** — the current system is more epistemically careful.
7. **Auth and multi-device use** — it is a real web app tied to an account.
8. **Dev / production separation** — Preview can be tested in-browser without treating production data as disposable.
9. **Better UI foundation** — themes, contrast tests, reusable components, mobile considerations, coherent navigation.
10. **Audit/history infrastructure** — reliable history, undo, imports, and future evaluation are now possible.

---

# Where the old conversational design was stronger

1. **Rooms felt more connected.** Every room was repeatedly asked what it sends to Schedule, Today, Review, and NOVA.
2. **Schedule had a clearer system identity.** “Basement floor” is stronger than “calendar room.”
3. **Review was more ambitious.** It governed changes to the system, not only summaries.
4. **Mind / Capacity had more operational impact.**
5. **NOVA felt more ambient.** It was envisioned as an always-available command layer.
6. **The signal model was useful.** Rooms could request time, attention, protection, or recovery without directly mutating each other.

---

# Most important differences by priority

| Priority | Historical intent | Current repo | Judgment |
|---|---|---|---|
| 1 | Today as front desk | Strong Today hierarchy | Mostly preserved |
| 2 | Schedule as basement/time foundation | Strong calendar/schedule capability | Functional parity, weaker signal ownership |
| 3 | Review as control room | Evidence/recovery Review | Needs stronger governance role |
| 4 | Rooms emit signals, not direct cross-writes | Typed records + links | Concept worth reintroducing |
| 5 | Habits protect floor, not streak score | Floor/optional + partial/skip | Strongly preserved |
| 6 | Routines full/short/minimum | Implemented and polished | Excellent preservation |
| 7 | Mind controls realistic day capacity | User-word state logging | Safer, but less operational |
| 8 | NOVA as analyst/command layer | Strong AI harness/capture | Technically improved; could be more ambient |
| 9 | Archive preserves instead of deletes | Archive + History | Improved |
| 10 | User rules constrain system | Settings + authority architecture | Present, UI can mature |
| 11 | Sandbox before live change | Sandbox/demo/dev separation | Strongly preserved |
| 12 | Boundary Map personalization | Mostly absent | Probably fine to postpone |

---

# Recommended synthesis

## A. Make room contracts product-facing again

For every room, answer:

1. What does it own?
2. What can it ask Schedule for?
3. What can it show on Today?
4. What should Review revisit?
5. What can NOVA observe/suggest?
6. What may never happen silently?

This was one of the strongest old design disciplines.

## B. Restore a lightweight Signal layer

A signal should not mutate another room. It should communicate things like:

- `needs_time`
- `needs_attention`
- `needs_protection`
- `needs_recovery`
- `conflict`
- `overdue`
- `capacity_warning`

Then Schedule handles time signals, Today decides what deserves attention now, Review handles recurring/system changes, and NOVA explains them.

## C. Deepen Review before adding exotic intelligence

Review should become the place where the user changes the *rules of the system* based on evidence: reduce habit frequency, promote an action into a routine, park a project, protect a gym block, simplify a routine, change a meal-prep pattern, archive stale items, and change what Today emphasizes.

## D. Make NOVA accessible across rooms

The current harness is already technically capable. The UX can revive the older idea of NOVA as a launcher/command layer or “Ask NOVA about this room.”

## E. Let capacity influence suggestions, not reality

The old Mind room had the useful question:

> **How much can this day realistically carry?**

Keep current subjective state observations, but allow Today/Review/NOVA to make optional suggestions such as using a minimum routine or protecting the floor. Do not turn those observations into objective identity/state claims.

---

# Bottom line

The current repository has recovered **far more of previous LTS than it first appeared to**. The feature list is already close to the mature historical room list.

What is missing is less about **tabs** and more about **relationships between tabs**.

The older conversations increasingly described this topology:

> **Schedule owns time.  
> Today owns execution.  
> Review owns governance.  
> Rooms own their domain.  
> Archive owns memory.  
> Settings own constraints.  
> NOVA interprets and suggests.**

The current repo excels at:

> **typed data, safe mutations, provenance, AI tooling, persistence, and robust room capability.**

The strongest LTS 1.0 would combine them:

> **Old LTS product topology + current LTS engineering foundation.**

For ongoing development, the best question is no longer “which old tabs do we still need to rebuild?” It is:

> **What did this room used to mean in the system, beyond storing records?**

The highest-value opportunities are Review governance, Schedule as receiver of cross-room time/protection signals, Today as the prioritized execution result of the whole system, Mind/Capacity as advisory influence on plan intensity, NOVA as a persistent cross-room interpreter, and explicit room contracts so the connections remain intelligible.
