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

# Old Repo Salvage Report — LTS static v2.9.7

**Subject:** `lts-static-v2.9.7.zip` (SHA-256 `f568528b…e1109`), 34 files, ~5.4k lines. Extracted for
review to `/tmp/legacy/lts-static-v2.9.7-reference` (never committed).

**Ratings:** **GREEN** = carry the concept forward now (re-implement, don't copy). **YELLOW** = right
idea, wrong shape; redesign or defer. **RED** = do not carry forward.

## Headline

The product thinking is far ahead of the code. Approval-before-write, ambiguity reasons, deterministic
grounding of model output, routine variants, and "minimum version counts" are all worth keeping. The
code is one ~500 KB `script.js` (3,125 lines, 339 of them over 400 characters) holding a global
mutable `state`, about 240 string-HTML `data-action` handlers routed through one `handle()` switch,
and `localStorage` as the database. Parts of the architecture were never actually wired up:
Supabase is configured in `lts-config.js` but `script.js` never references it, and
`features/schedule.js` (the only Supabase-aware module) is imported by nothing.

Verified defects (run in Node against the extracted code):

- `weekdayDateFromText` builds ``new RegExp(`\b${n}\b`)`` inside a template literal. That `\b` is a
  backspace character, so short day names ("sat", "mon") never match, and "work sat 2-7" lands on
  the currently selected date.
- `normalizeHour(7, false)` returns 19, so "class 7am-8am" becomes 19:00–08:00. The local parser
  has no `end > start` check; only the Worker path validates that.
- The Worker parses dates in UTC (`dateKey` uses `toISOString`), while the frontend uses local
  dates (`getLocalDateKey`). Late-evening captures can resolve to the wrong day.
- The legacy "tests" (`test-import.mjs`, `test-browser-import.mjs`) only check that the module
  imports. Both pass; they assert no behavior.

## Subsystem ratings

### Product doctrine and docs

| Item                                                                       | Rating | Why                                                                                              | Where                                                 |
| -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Life-compiler doctrine, non-negotiables, room-contract direction           | GREEN  | Clear, still correct; became the constitution and pipeline                                       | `handoff/LTOS_3_0_Handoff_v1.md`, `modules/README.md` |
| "Don't make the user good at prompting"; "Say anything" single input       | GREEN  | Drives Today-with-capture-on-top design                                                          | `README.txt`, handoff "ChatGPT lesson"                |
| Snap!/slots metaphor (holes, not paragraphs)                               | GREEN  | Missing slots render as chips                                                                    | handoff "Snap! lesson", `commandBlockSlots`           |
| "Hide provider/company name in UI"                                         | YELLOW | Harmless, but not a product principle. Show model id in provenance; the provider stays in config | handoff non-negotiables                               |
| Version-label checklists ("search for old version strings before zipping") | RED    | A symptom of hand-zipped releases; replaced by tags + CI                                         | `BUILD_NOTES_v2_9_7.md`                               |

### Intake / parsing (NOVA command surface)

| Item                                                                                              | Rating                       | Why                                                                                                                                                           | Where                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Approval preview before any write; grouped by kind; per-item and per-group approve                | GREEN                        | Core invariant of LTS 1.0                                                                                                                                     | `previewCommandImport`, `approveCommandImport`                                                                                                                           |
| Ambiguity reasons ("date came from words", "time used AM/PM assumption", "estimate needs review") | GREEN                        | Become typed `warnings` codes; the best small idea in the code                                                                                                | `commandPreviewNeedsConfirmation`                                                                                                                                        |
| "Confirm edited blocks before approval" gate                                                      | GREEN                        | Becomes `needs_input` → `ready` status                                                                                                                        | `approveCommandImport` (unconfirmed check)                                                                                                                               |
| Import batch with source text and batch id stamped on created rows                                | GREEN                        | Becomes `captures` + `origin_item_id` provenance                                                                                                              | `approveCommandImport` → `state.importHistory`, `sourceType/sourceId`                                                                                                    |
| Local deterministic parser as fallback                                                            | GREEN (concept) / RED (code) | Keep a deterministic path for simple, explicit input and AI outages; rewrite it with tests. The regexes have the bugs above and depend on global `state.date` | `parseCommandLine`, `parseCommandToPreview`, `normalizeImportTextForSections`, `splitWorkScheduleEntries`, `weekdayDateFromText`, `dateFromFlexibleDue`, `normalizeHour` |
| Section headers in pasted text ("Assignments:", "Work this week:") as context                     | YELLOW                       | Useful heuristic for long pastes; low priority once a model interprets                                                                                        | `normalizeImportTextForSections`                                                                                                                                         |
| Hard-coded class-name guessing (`/stat/ → 'Statistics I'`)                                        | RED                          | Personal data baked into parsing logic                                                                                                                        | `parseCommandLine` assignment branch                                                                                                                                     |
| Snap blocks UI, Ready lane, compiler rail                                                         | YELLOW                       | Interaction idea is good (slots → ready → approve); the DOM/string implementation is not reusable                                                             | `renderNovaWorkspace`, `compactCommandBuilderCards`, `commandBlockSlots`, `saveConfirmedLifeBlock`                                                                       |

### AI Worker (`worker/src/index.js`)

| Item                                                                        | Rating | Why                                                                                     | Where                                                                         |
| --------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Keys server-side only; frontend stores only a URL                           | GREEN  | Same rule in 1.0 (server-only env)                                                      | `AI_WORKER_SETUP.md`, `groqParse`                                             |
| Versioned structured contract `lts-import-v1` with allowed kinds            | GREEN  | Becomes the zod proposal contract                                                       | `systemPrompt`, request check in `fetch`                                      |
| Deterministic override of model dates/times from the item's `sourceLine`    | GREEN  | Pipeline step "normalization". It addresses the main LLM failure mode (date arithmetic) | `normalizeParsed`, `explicitTimeRangeFromSource`, `explicitDueDateFromSource` |
| Drop invalid items with a warning instead of failing the batch              | GREEN  | Same policy, but logged to `harness_runs`                                               | `normalizeParsed` try/catch                                                   |
| Prompt rule "Never invent private facts… nothing is written until approval" | GREEN  | Keep in the system prompt                                                               | `systemPrompt`                                                                |
| `Access-Control-Allow-Origin: *`, no auth on `/api/lts/parse`               | RED    | Anyone who finds the URL can spend the model key                                        | `CORS`, `fetch` handler                                                       |
| Provider hard-wired (Groq URL, model default)                               | RED    | Replaced by a Vercel AI Gateway adapter; the model is chosen by env                     | `groqParse`                                                                   |
| UTC date handling                                                           | RED    | Mismatch with the frontend's local dates                                                | `dateKey`, `parseDateKey`                                                     |
| Errors returned as HTTP 200 with `error` field                              | RED    | Hides failures; 1.0 records them in `harness_runs` and falls back explicitly            | `fetch` catch                                                                 |
| Serper/search key plumbing                                                  | RED    | Never used ("reserved for a later pass")                                                | `fetch`, `wrangler.toml`                                                      |
| Windows `deploy-worker.cmd`                                                 | RED    | Replaced by Vercel deploys                                                              | `worker/deploy-worker.cmd`                                                    |

### Persistence and state

| Item                                                                                | Rating                       | Why                                                                                                                                                           | Where                                                                 |
| ----------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `localStorage` as canonical store                                                   | RED                          | Single device, no transactions, quota errors swallowed                                                                                                        | `services/storageService.js` (`writeJSON` logs and continues), `save` |
| 49 legacy storage keys tried in order                                               | RED                          | Unbounded migration debt                                                                                                                                      | `legacyStorageKeys`, `loadStateFromStorage`                           |
| One giant `defaultState()` (≈90 top-level keys) and `normalizeState`                | RED                          | Schema-by-convention; replaced by a Drizzle schema + migrations                                                                                               | `defaultState`, `normalizeState`                                      |
| Seed data with realistic body metrics (height/weight/age/sex, TDEE)                 | RED                          | Health data in defaults; 1.0 seeds a fictional user only                                                                                                      | `defaultState().tdeeProfile`                                          |
| Sandbox instances / fake user generator                                             | GREEN (concept) / RED (code) | The need is real: try changes without touching real data. 1.0 uses a seeded fictional user and a local DB instead of instance-switching inside `localStorage` | `createSandboxFromCurrent`, `fakeUserState`, `switchInstance`         |
| Export / import JSON                                                                | YELLOW                       | Keep data export (M8); import only as a one-off legacy migration if wanted                                                                                    | `exportData`, `exportInstance`, `importInstanceFromForm`              |
| `utils/dates.js` local-date parsing (avoids the `new Date('YYYY-MM-DD')` UTC shift) | GREEN                        | Correct insight; rewritten in `src/domain` with timezone-aware tests                                                                                          | `getLocalDateKey`, `parseLocalDate`                                   |
| `uid()` (time + Math.random)                                                        | RED                          | Postgres `gen_random_uuid()` replaces it                                                                                                                      | `uid`                                                                 |

### Rendering and app shell

| Item                                                                            | Rating           | Why                                                                                                           | Where                                                                  |
| ------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| String-template HTML with `innerHTML`, `esc()` everywhere                       | RED              | Fragile XSS surface, no components; React replaces it                                                         | `app`, `renderScreens`, all `render*` and `*Card` functions            |
| Single `handle(action)` switch for ~240 actions; full re-render on every change | RED              | Untestable, global coupling                                                                                   | `handle`, `bind`, `app`                                                |
| 15 static room HTML shells loading the same script                              | RED              | Replaced by app routes                                                                                        | `static-site-upload/*/index.html`                                      |
| OS-style taskbar, launcher, "Apps" menu, workspace modes                        | RED for v1       | "Dashboard/button soup" (the handoff itself warns against it). 1.0 has ≤ 5 routes                             | `renderOSTaskbar`, `openMoreMenu`, `openNovaLauncher`, `shellSettings` |
| Blueprint visual theme (`styles.css`, 1,009 lines)                              | YELLOW           | Visual reference only for colors/feel                                                                         | `styles.css`                                                           |
| `features/schedule.js` "vertical slice" with DB-first write                     | YELLOW (pattern) | Pattern is right (DB write before in-memory mutation, `user_id` belt-and-braces), but the module is dead code | `updateBlock`, `deleteBlock`                                           |

### Today / Schedule

| Item                                                                                        | Rating | Why                                                                      | Where                                                                 |
| ------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Today as the action surface (current/next block, floor first)                               | GREEN  | The 1.0 home screen                                                      | `renderToday`, `todayPlan`, `currentOrNextRoutineBlock`               |
| Schedule blocks with label, fixed flag, source                                              | GREEN  | Becomes `schedule_blocks` (timestamptz instead of minutes + date string) | `state.blocks`, `saveBlock`                                           |
| Signals: unscheduled deadlines → suggested focus block                                      | YELLOW | Good Review/suggestion input; later milestone                            | `computeSignals`, `placeSignal`, `placeAssignment`                    |
| Schedule sets with season "modes" (`Healing`, `Fall`, `Rise`, `Burned by Sun`, `Ascension`) | RED    | Personality-like taxonomy; violates "operating state, not identity"      | `SEASON_MODES`, `scheduleSets`, `applyDecisionChange` `change_season` |
| Raw schedule paste import                                                                   | YELLOW | Covered by capture + parser                                              | `openFixedImport`, `parseRawSchedule`                                 |

### Routines and habits

| Item                                                                      | Rating | Why                                                         | Where                                                          |
| ------------------------------------------------------------------------- | ------ | ----------------------------------------------------------- | -------------------------------------------------------------- |
| Routine versions `full` / `compressed` / `emergency`                      | GREEN  | M6 variants (`full` / `short` / `minimum`)                  | `routineStepsFor`, `routineVersionMinutes`, `normalizeRoutine` |
| "Minimum viable version counts" (logging the minimum is success)          | GREEN  | Constitution Article 4 in code                              | `logHabitMinimum`, `habitRecoveryRules`                        |
| Floor vs optional habits; hide optional on low capacity                   | GREEN  | Floor concept                                               | `habits[].floor`, `visibleHabitsForCapacity`                   |
| Recommend a smaller variant after misses (not a penalty)                  | GREEN  | M6 recovery suggestion                                      | `routineCapacityRecommendation`, `routineRecommendationText`   |
| Step-level friction (which step gets skipped)                             | YELLOW | Valuable Review input once run data exists                  | `routineStepFriction`                                          |
| Habit risk labels ("floor risk", "needs review", "intentionally reduced") | YELLOW | Non-shaming wording worth keeping; thresholds are arbitrary | `habitRiskLevel`                                               |
| Separate Habits and Routines rooms                                        | YELLOW | 1.0 merges them: a habit is a one-step routine              | `renderHabits`, `renderRoutines`                               |
| Assignment study sprints linked to routines                               | YELLOW | Later; tasks first                                          | `assignmentStudySprintRoutine`, `placeAssignmentStudySprint`   |

### Mind / Capacity

| Item                                                                                                                     | Rating                           | Why                                                                                                                 | Where                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Capacity affects the plan (lighter routines, protect floor)                                                              | GREEN (concept)                  | Keep as suggestion, citing the user's own words                                                                     | `mindRecoveryPlan`, `routineVersionForCapacity`                                            |
| Import of "tired/exhausted" into numeric `capacity/energy/stress` + `mode: 'Survival Day'`, saved with `sensitive:false` | RED                              | Inference stored as observation about health; the main reason for ADR 0006                                          | `parseCommandLine` mind branch, `approveCommandImport` mind branch, Worker `fallbackParse` |
| Day modes (Full/Normal/Light/Recovery/Survival) from thresholds                                                          | RED as taxonomy / YELLOW as rule | Pseudo-precise and label-like. A transparent rule ("you said 'exhausted' today → suggest minimum variants") is fine | `capacityMode`, `capacityDetails`, `capacityRules`                                         |
| Mind trend / warning flags                                                                                               | YELLOW                           | Only as cited, provisional inferences in Review (M7)                                                                | `mindTrendSummary`, `mindWarningFlags`                                                     |
| Privacy settings per category; "Mind does not silently change other rooms"                                               | GREEN                            | Becomes per-category AI opt-in + sensitivity column                                                                 | `privacySettings`, `mindPermissionSummary`                                                 |

### Review, decisions, governance

| Item                                                                                                                                           | Rating                        | Why                                                                              | Where                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Approvals log with before/after snapshots                                                                                                      | GREEN                         | Becomes `change_log`                                                             | `approveDecision` → `state.approvals`                                              |
| Decision lifecycle (pending → approved → applied / needs_review)                                                                               | GREEN                         | Same lifecycle as `proposal_items.status`                                        | `approveDecision`, `dismissDecision`                                               |
| Applying decisions by substring-matching free text (`change.includes('archive')`, `'3x'`), hard-coded times (9:00, 12:00, 16:00, 17:00, 20:00) | RED                           | Non-deterministic, unreviewable writes; typed proposals replace it               | `applyDecisionChange`, `createBlockFromDecision`                                   |
| Advisor cards with dismiss/snooze/never + dismissal memory                                                                                     | YELLOW                        | Good anti-nag idea for M7 suggestions                                            | `dismissAdvisorCard`, `snoozeAdvisorCard`, `neverAdvisorCard`, `rememberDismissal` |
| Settings change requests + snapshots + rollback                                                                                                | YELLOW                        | Proposal + change_log covers it generically; no separate governance subsystem    | `createSettingsProposal`, `rollbackSettingsLast`, `settingsGovernance`             |
| Capture staleness / repeated-capture grouping                                                                                                  | YELLOW                        | Review input later (backlog)                                                     | `captureRepeatedGroups`, `capturePatternType`, `captureStaleItems`                 |
| Stabilization checks (orphans, invalid times) and percentage score                                                                             | YELLOW (checks) / RED (score) | Checks become DB constraints and tests; the % "health score" is pseudo-precision | `stabilizationChecks`, `stabilizationScore`                                        |
| Archive collections, season archive, parking lot                                                                                               | YELLOW                        | "Parking lot" maps to `tasks.status = parked`; the rest is deferred              | `archiveCollections`, `createSeasonArchive`, `saveParkedItem`                      |

### Other domains

| Item                                                             | Rating     | Why                                                                        | Where                                                                  |
| ---------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Assignments with next action, tasks, sessions                    | YELLOW     | v1 uses `tasks` with `kind = assignment/exam` and `due_on`; sessions later | `assignments`, `assignmentTasks`, `renderAssignments`                  |
| Fitness split, exercises, lite sessions, missed-workout recovery | YELLOW     | Lite session = routine minimum variant; full fitness domain deferred       | `fitnessSessionPlan`, `placeLiteFitness`, `fitnessMissedRecoveryQueue` |
| Diet: meal windows, protect meals, workout fuel                  | YELLOW     | "Protect a meal window" is a schedule block kind in v1; logging deferred   | `dietMealWindows`, `protectMeals`, `placeWorkoutFuelBlock`             |
| TDEE calculator, macro targets, food DB                          | RED for v1 | Health computation with no v1 consumer (Article 7)                         | `calculateTDEE`, `dietTargets`, `foods`                                |

### Testing and release

| Item                                   | Rating | Why                                                                                       | Where                                        |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| Import-only smoke tests with DOM stubs | RED    | Assert nothing; 1.0 uses Vitest + Playwright                                              | `test-import.mjs`, `test-browser-import.mjs` |
| Test prompts in docs                   | GREEN  | Become golden fixtures (e.g. "work saturday 2-7, homework 5 due thursday, call pharmacy") | `README.txt`, `AI_WORKER_SETUP.md`           |
| `node --check` + grep checklist        | RED    | CI replaces it                                                                            | `BUILD_NOTES_v2_9_7.md`                      |

## Bottom line

Keep the doctrine, the approval loop, the ambiguity reasons, deterministic grounding of model
output, routine variants, minimum-counts, floor-first, and the test prompts. Drop the runtime,
storage, rendering, mode taxonomies, the free-text decision applier, and the scores. Detailed
destinations are in [reuse-map.md](reuse-map.md).
