# 0002. Ship a web app, not Electron

Status: Accepted
Date: 2026-10-07

## Context

LTS is used from a phone and a laptop throughout the day. It needs server-side secrets (model
keys), server-side transactions, and one copy of the data. Nothing in v1 needs filesystem, tray,
or offline-first desktop access.

## Decision

A responsive web app deployed to Vercel. Installable as a PWA later if home-screen launch matters.

## Consequences

- One codebase reaches phone and laptop; no installers, signing, or auto-update.
- Requires connectivity for capture in v1. Revisit only if real usage shows captures lost offline
  (then: a local outbox queue, still not Electron).
