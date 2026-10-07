# Architecture Decision Records

One short file per decision that would be expensive to reverse. Copy the template, take the next
number, keep it under a page. Superseded ADRs stay; mark them `Superseded by NNNN`.

| ADR                                             | Decision                                                          | Status   |
| ----------------------------------------------- | ----------------------------------------------------------------- | -------- |
| [0001](0001-old-repo-reference-only.md)         | The v2.9.7 static build is reference-only                         | Accepted |
| [0002](0002-web-app-not-electron.md)            | Ship a web app, not Electron                                      | Accepted |
| [0003](0003-framework-nextjs-single-app.md)     | Next.js (App Router) as the one application framework             | Accepted |
| [0004](0004-postgres-on-supabase.md)            | PostgreSQL on Supabase, Drizzle for schema and migrations         | Accepted |
| [0005](0005-ai-tools-not-raw-db-access.md)      | AI uses bounded LTS tools and returns proposals; no raw DB access | Accepted |
| [0006](0006-observations-are-not-inferences.md) | Observations and inferences are separate records                  | Accepted |
| [0007](0007-github-canonical.md)                | GitHub is the canonical home for code, issues, and CI             | Accepted |
| [0008](0008-single-package-not-monorepo.md)     | One package with enforced folders, not a monorepo                 | Accepted |

## Template

```md
# NNNN. Title

Status: Proposed | Accepted | Superseded by NNNN
Date: YYYY-MM-DD

## Context

What forces this decision. Evidence, not taste.

## Decision

What we do.

## Consequences

What gets easier, what gets harder, what would make us revisit.
```
