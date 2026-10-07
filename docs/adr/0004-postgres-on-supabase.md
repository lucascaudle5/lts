# 0004. PostgreSQL on Supabase, Drizzle for schema and migrations

Status: Accepted (revised 2026-10-07: tenancy wording, Marketplace env names)
Date: 2026-10-07

## Context

The data is relational (blocks, tasks, proposals, change log all reference each other), approval
must be atomic across tables, and history must be queryable for Review. The legacy build had
Supabase keys configured but never used them; `localStorage` was canonical.

## Decision

- PostgreSQL hosted on Supabase (free tier), also providing Auth. Local development uses the
  Supabase CLI stack. Production is provisioned through the Vercel Marketplace integration so its
  env vars sync into the Vercel project.
- Drizzle ORM defines the schema in TypeScript and generates SQL migrations into `db/migrations/`.
- The server connects with `POSTGRES_URL` (pooled, transaction mode, prepared statements off);
  migrations use `POSTGRES_URL_NON_POOLING`. RLS is enabled on every table with no policies for the
  `anon`/`authenticated` roles, so the browser's publishable key cannot read data. Repositories
  filter by `user_id`.
- No foreign keys into Supabase's `auth` schema, so tests run on plain Postgres.

## Consequences

- Real transactions, constraints, and SQL for Review queries.
- **Multi-tenant-conscious, not guaranteed.** The server's connection bypasses RLS, so a missing
  `user_id` filter in a repository could leak another user's data. Cross-user isolation tests for
  every repository function and tool are the mitigation, not a guarantee. If LTS ever has real
  multiple users, revisit: run user-scoped queries under a role that RLS applies to.
- Two Supabase features we deliberately do not use in v1: client-side table access and Edge
  Functions.
- Moving off Supabase means replacing Auth only; the data is plain Postgres.
