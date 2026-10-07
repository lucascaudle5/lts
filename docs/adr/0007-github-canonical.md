# 0007. GitHub is the canonical home for code, issues, and CI

Status: Accepted
Date: 2026-10-07

## Context

The project was bootstrapped in a Cursor-hosted Git repository. Lucas wants a normal,
portfolio-visible workflow: PRs, Issues for the backlog, Actions for CI, Vercel previews.

## Decision

- Once Lucas creates the GitHub repository (see the git setup guide), GitHub `main` is the source
  of truth. The Cursor-hosted remote stays as a secondary remote (`origin` or renamed) or is
  dropped; it is never the place where releases are tagged.
- CI is `.github/workflows/ci.yml`. Backlog is GitHub Issues with the `backlog` label;
  `docs/BACKLOG.md` is only the interim parking lot and is migrated to Issues then deleted.
- Releases are annotated tags `v0.x.y` pushed to GitHub; `v1.0.0` marks the freeze.

## Consequences

- Until the GitHub repo exists, CI does not run remotely; run `pnpm check` locally before merging.
- Pushing to two remotes is possible but optional; pick GitHub for everything once it exists.
