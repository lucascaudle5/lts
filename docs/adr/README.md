# Architecture Decision Records

One short file per decision that would be expensive to reverse. Copy the template, take the next
number, keep it under a page. Superseded ADRs stay; mark them `Superseded by NNNN`.

**Stack lock (from M1 on).** Replacing Next.js, Supabase, Drizzle, the proposal/mutation
architecture, or the repository structure is not discussed unless implementation produces concrete
evidence that it is blocking — a failing test, a measured limit, or a requirement that cannot be
met. That evidence goes in the new ADR's Context section; "a newer tool looks nicer" does not count.
ADRs 0011 and 0012 add product rules and a code-organization convention. They do not change the
stack.

**Precedence.** The constitution (as amended) outranks ADRs, ADRs outrank `AGENTS.md` and the working
docs, and those outrank `docs/planning/` (see [0011](0011-constitution-amendments-2026-10-08.md)).

| ADR                                                | Decision                                                                             | Status   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| [0001](0001-old-repo-reference-only.md)            | The v2.9.7 static build is reference-only                                            | Accepted |
| [0002](0002-web-app-not-electron.md)               | Ship a web app, not Electron                                                         | Accepted |
| [0003](0003-framework-nextjs-single-app.md)        | Next.js (App Router) as the one application framework                                | Accepted |
| [0004](0004-postgres-on-supabase.md)               | PostgreSQL on Supabase, Drizzle for schema and migrations                            | Accepted |
| [0005](0005-ai-tools-not-raw-db-access.md)         | AI uses bounded tools and proposals; all domain writes go through one mutation layer | Accepted |
| [0006](0006-observations-are-not-inferences.md)    | Observations and inferences are separate records                                     | Accepted |
| [0007](0007-github-canonical.md)                   | GitHub is the canonical home for code, issues, and CI                                | Accepted |
| [0008](0008-single-package-not-monorepo.md)        | One package with enforced folders, not a monorepo                                    | Accepted |
| [0009](0009-password-based-sign-in.md)             | Supabase Auth email/password for routine sign-in                                     | Accepted |
| [0010](0010-typed-workspace-records.md)            | Typed workspace records preserve the existing mutation and approval architecture     | Accepted |
| [0011](0011-constitution-amendments-2026-10-08.md) | Constitution amendments of 2026-10-08 and document precedence                        | Accepted |
| [0012](0012-room-modules-and-signals.md)           | Room modules, typed derived signals, no hidden coupling                              | Accepted |

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
