# 0008. One package with enforced folders, not a monorepo

Status: Accepted
Date: 2026-10-07

## Context

The brief floated `apps/web`, `apps/api`, `packages/domain|contracts|ai|db|ui|config`. Those
boundaries are right; workspaces are a way to enforce them, at the cost of per-package build,
tsconfig, and versioning for a single consumer.

## Decision

One package. The same boundaries are folders under `src/` (`contracts`, `domain`, `ai`, `server`,
`app`, `components`) with import rules enforced by ESLint `no-restricted-imports` from M1.

## Consequences

- One `package.json`, one test run, one build.
- If a second consumer appears (native app, background worker), move `contracts` + `domain` into
  `packages/` then; the folder boundaries make that a mechanical move.
