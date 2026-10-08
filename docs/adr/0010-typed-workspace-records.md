# 0010. Typed records for the complete workspace

Status: Accepted
Date: 2026-10-08

## Context

Lucas explicitly requested a working app spanning all legacy rooms now. The legacy stores all
domains in one unvalidated browser object. The current database already owns tasks, schedule,
observations, captures and audit history; duplicating these would break existing approval flows.

## Decision

Keep the existing stack and domain tables. Add `life_records` for habits and logs, routines and
runs, fitness plans/exercises/logs, foods/templates/meals/targets, reported state, projects, money,
and reviews. Its JSONB payload is a Zod discriminated union, checked against the row type in
Postgres and validated at every read/write boundary. Parent references are checked for user
ownership inside `runMutations`; all changes and before/after snapshots share a transaction.

Add structured task details, archive timestamps, schedule series IDs, and monotonic audit order.
Do not store the legacy application state or execute free-text decision rules. Review cites
records and offers explicit controls. Mental state remains user-reported text.

## Consequences

The app can ship all rooms without replacing current data or the mutation layer. JSONB parent
references are application-enforced, so isolation and rollback tests are essential. Queries load
the user's workspace for this first version; split into indexed domain tables or paginated queries
when actual volume or query requirements demonstrate the need. Backups use typed versioned data.

Hosted builds apply additive migrations only after checking that both Auth and Postgres match the
intended Preview/Production Supabase project. Build failure prevents a code release, but an already
applied additive migration is not rolled back. Future destructive migrations require a separate plan.
