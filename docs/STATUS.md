# Status

Last updated 2026-10-08 (design batch 1).

## Current delivery

The `m4-ai-harness` branch contains the complete workspace candidate, version `0.4.0`:
Today, schedule, tasks/assignments, habits, routines, fitness, diet, Mind, projects, money,
Review, history/archive, sandbox/demo, settings, and NOVA capture with Gateway and parser fallback.
See [LEGACY_PARITY.md](LEGACY_PARITY.md) for features and explicit boundaries and
[ADR 0010](adr/0010-typed-workspace-records.md) for the typed supplemental record design.

M0–M3 are merged; Production is still the M3/password sign-in release. This candidate adds manual
tracking across the parity sprints while preserving existing auth, proposals, mutations and audit.

## Design batch 1

The `design-batch-1` branch applies the first design pass (see [UI.md](UI.md)): three themes
(Sandstone default, Blueprint, Dark) stored on the account in `profiles.theme` with a pre-paint
cache, the rail shell with an active-room nav and a quick switch, a Settings Appearance card, Today
as one hierarchy (Up next, the floor, gentle heavy-day and done-day states), Routines as the
exemplar room, and a polished capture review. No new product behavior beyond `profile.save`
accepting an optional `theme`. Verified here: `pnpm check` (405 unit tests including the three-theme contrast guard, theme store, nav, Today model, routine runner and capture card), `pnpm build` (`/demo` still prerenders) and `pnpm test:db` (57 tests, including the `profile.save` theme change and its audit row). The signed-in screens were checked from seeded data, not a live sign-in. Not yet covered: the other rooms (Habits, Fitness, Food, Schedule,
Tasks, Review, History still use the old layouts with the new tokens), the sign-in redesign, and
the optional time-of-day tint beyond Today.

## Checks already completed

Before Lucas asked to stop testing and open the PR:

- `pnpm check`: passed, including 260 unit tests.
- `pnpm build`: passed.
- `pnpm test:db`: passed, 56 tests in seven files against disposable Postgres 17.
- Gateway evaluation revealed a five-requests/minute quota and exact-field discrepancies. The
  paced rerun completed at 87.0% (127/146 fields), with zero provider failures. The 90%
  acceptance gate remains unmet.

The final public demo, sandbox import/export adjustments and version bump were added after those
checks. No further tests or browser verification are being run, per Lucas's explicit instruction.
CI can report on the pushed PR. This is a development candidate, not a production release/tag.

## Dev and Production

One Vercel project, separate environment connections: Preview uses `lts-dev`
(`aiioatnjffphxygqmiap`); Production uses `lts` (`kcnsibqyloxuuvsoofta`). Hosted builds validate both
Auth and Postgres references, then apply additive migrations. Preview Secrets are intentionally not
exportable by the CLI. Use the branch Preview to try updates; no local services are needed.

The public `/demo` contains fictional data and browser-memory changes only. `/today` and all saved
account data, exports and server mutations still require authentication. JSON import creates new
records rather than replaying historical captures or audit logs.

## Follow-up

Review the candidate on Preview and complete authenticated desktop/phone flows when Lucas is ready.
Resolve real-provider evaluation results before calling M4 fully accepted. Production promotion and
release tagging happen after review and green CI.
