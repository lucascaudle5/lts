# Legacy parity — complete workspace candidate

The v2.9.7 ZIP is the behavioral reference. The current Next.js/Supabase app remains canonical.
All saved domain changes use the existing validated, user-scoped, audited mutation layer.

| Surface             | Working capability                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today               | Current/next schedule, due and overdue work, floor habits, routines, frontiers, upcoming bills, meals/workouts, recent changes, NOVA capture                                       |
| Schedule            | Day/week/month navigation, fixed and movable commitments, occurrence edits, bounded weekly recurrence, series archive, overlap confirmation, typed bulk import                     |
| Tasks / Assignments | Create/edit, priority/due/status, overdue filter, estimate/next step/blocker, project links, subtasks, timer and logged sessions, completion/parking/archive                       |
| Habits              | Floor/optional, cues, days, check/count/minutes, minimum target, daily log upsert, partial/intentional skip and weekly counts                                                      |
| Routines            | Full/short/minimum steps, anchors/days, checklist runs, partial/skip; completing the configured minimum counts                                                                     |
| Fitness             | Split/session plans, exercise library and substitutions, sets/reps/load/RPE notes, workout outcomes, bodyweight logs, next session and protected schedule links                    |
| Diet                | Food library/favorites, editable repeated meals and templates, meal windows, entered macro/calorie totals, optional targets, unknown measurements stay unknown                     |
| Mind                | Sleep time/duration, mood/energy/stress/capacity in the user's words, dated state notes, original capture observations with correction/archive                                     |
| Projects            | Status, next action, due date, up to three active frontiers, task links and Today visibility                                                                                       |
| Money               | Income/expenses/bills, currency-separated monthly totals, due obligations, paid status and weekly/monthly recurring bills                                                          |
| Review              | Day/week/season evidence, overdue and partial-completion recovery controls, dismiss/snooze within a saved review, cited records and decisions                                      |
| History / Archive   | Audit before/after/provenance, latest-change undo, search/type/collection filters, sensitive records hidden by default, restore, season archive, full JSON export and typed import |
| Sandbox             | Fictional workspace, all room controls, copy current workspace for a temporary dry run, reset/export; browser memory only                                                          |
| NOVA                | Capture → bounded Gateway interpretation → validation/grounding → editable proposal review → audited approval; parser fallback and narrow risk-language stop                       |
| Settings            | Appearance (Sandstone, Blueprint, Dark, saved on the account), timezone, sensitive-category opt-in, ask-first/default or explicit task-add permission                              |

## Boundaries in this first version

- Fitness set details are editable text; there is no automatic progression prescription.
- Review is a deterministic evidence summary with user decisions. Model-generated Review
  inferences and conversational history Q&A are not implemented yet.
- Direct authority supports an explicit `Add task: …` command. Other captures remain proposals.
  The allowlist, Settings controls and per-change undo for wider direct execution are described in
  Constitution Amendment 4 and are not built.
  Major rewrites and bulk archive/import require explicit confirmation.
- Sandbox changes disappear on refresh. Export preserves a dry run; it does not alter the account.
- JSON import creates new domain records and remaps references, up to 500 records per import.
  Capture/proposal/audit history and profile settings are exported but are not replayed on import.
- This preserves practical behavior without invented modes, inferred scores, diagnoses, assumed body
  metrics, or free-text mutation rules. Streaks and labeled self-reported scales are allowed by the
  2026-10-08 amendments but are not built yet. `docs/MODULE_PARITY.md` tracks what is missing per
  room.

## Legacy evidence

The actual `script.js` implemented the useful rooms in a large global object with localStorage
persistence. Its separate Supabase schedule module was not consistently connected and its checks
primarily covered syntax. Capture, routine variants, floor habits, substitutions, meal templates,
recovery choices, review decisions and archive collections supplied the interaction concepts.
Projects and Money were largely routing labels; the new app supplies practical manual records.
