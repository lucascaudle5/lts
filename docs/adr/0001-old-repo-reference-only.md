# 0001. The v2.9.7 static build is reference-only

Status: Accepted
Date: 2026-10-07

## Context

The legacy build is a ~500 KB single `script.js` with string-HTML rendering, one global mutable
`state`, `localStorage` as the database, 49 version-key migrations, and a Worker without auth.
Its product ideas (approval-first import, slots, routine variants, recovery-first habits) are
good; its structure is the reason the v2.9.x handoff asked to "stop patching the giant static
script".

## Decision

Keep the ZIP outside this repository. Re-implement concepts from the salvage report and reuse map;
copy no code. `LEGACY.md` records provenance (version, SHA-256, shape). `.gitignore` blocks
`legacy/` and `*.zip`.

## Consequences

- Clean history and licensing; no inherited coupling.
- Some small, correct helpers (local date parsing, HTML escaping) are rewritten instead of copied —
  a few lines each, and they get tests this time.
- Existing localStorage data is not migrated automatically. If Lucas wants history carried over,
  a one-off import script reading a legacy JSON export can be added as a backlog item.
