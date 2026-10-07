# 0003. Next.js (App Router) as the one application framework

Status: Accepted
Date: 2026-10-07

## Context

The brief suggested React + TypeScript + Vite. A Vite SPA is only a frontend: the AI harness,
model keys, and approval transaction still need a server, which means a second deployable (the
legacy build had exactly this split: static site + Worker, with CORS `*` and an unauthenticated
endpoint). For a solo student, every extra deployable is extra config, auth, and drift.

## Decision

Use Next.js App Router with React and TypeScript in a single app: Server Components for reads,
Server Actions / Route Handlers for writes and AI calls, Tailwind + shadcn/ui for UI.

## Consequences

- One deploy, one auth boundary, shared TypeScript types from UI to database, secrets never reach
  the browser.
- Next.js has its own concepts (server vs client components, caching) to learn; we keep usage
  plain (no edge runtime, no experimental features in app code).
- Revisit if a non-web client (native app, CLI) needs the same API: then extract `src/server`
  behind Route Handlers first, not a new framework.
