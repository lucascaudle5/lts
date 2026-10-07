# Legacy provenance

LTS 1.0 is a successor to the static-web build **Life Tracker Suite / Life Tracker OS v2.9.7
("Block UI Compression + Snap-feel Pass")**. That build is a **reference implementation only**
(see [ADR 0001](docs/adr/0001-old-repo-reference-only.md)).

| Fact           | Value                                                                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archive        | `lts-static-v2.9.7.zip` (167 KB, 34 files, ~5.4k lines)                                                                                                               |
| SHA-256        | `f568528bdad3dfb112c39a68ffa3ade835876e9177a3257b87c4f3025eee1109`                                                                                                    |
| Where it lives | Outside this repository (kept by Lucas; suggested local path `~/legacy/lts-static-v2.9.7-reference/`)                                                                 |
| Shape          | No-build static site (`static-site-upload/`, one ~500 KB `script.js`, 15 room HTML shells) plus a Cloudflare Worker (`worker/src/index.js`) that proxied a hosted LLM |
| Persistence    | Browser `localStorage`, key `lts-v297`, with 49 legacy migration keys                                                                                                 |

## Rules

- No legacy code is copied into this repository. The `.gitignore` blocks `legacy/` and `*.zip`
  so an extracted copy cannot be committed by accident.
- Concepts, test prompts, and lessons from the old build are carried forward **by
  re-implementation**, guided by the salvage report and reuse map (kept in the project notes,
  summarized in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#what-came-from-the-legacy-build)).
- When a new module re-implements a legacy idea, say so in the PR description
  (e.g. "re-implements legacy `commandPreviewNeedsConfirmation` as `validateProposal` warnings"),
  not in code comments.
