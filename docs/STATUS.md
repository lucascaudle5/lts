# Status

Last updated 2026-10-08.

## Current delivery

The `m4-ai-harness` branch contains the complete workspace candidate, version `0.4.0`:
Today, schedule, tasks/assignments, habits, routines, fitness, diet, Mind, projects, money,
Review, history/archive, sandbox/demo, settings, and NOVA capture with Gateway and parser fallback.
See [LEGACY_PARITY.md](LEGACY_PARITY.md) for features and explicit boundaries and
[ADR 0010](adr/0010-typed-workspace-records.md) for the typed supplemental record design.

M0–M3 are merged; Production is still the M3/password sign-in release. This candidate adds manual
tracking across the parity sprints while preserving existing auth, proposals, mutations and audit.

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
