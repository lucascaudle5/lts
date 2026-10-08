# 0006. Observations and inferences are separate records

Status: Accepted (clarified 2026-10-08 by [ADR 0011](0011-constitution-amendments-2026-10-08.md))
Date: 2026-10-07

## Context

The legacy import turned "I'm exhausted" into a Mind entry with `capacity: 2, energy: 3,
mode: "Survival Day"` and saved it as if the user had reported those numbers. That silently
converts an interpretation into a fact about Lucas's health.

## Decision

- `observations` hold what the user said or logged: category, the user's words (`value_text`), a
  number only if the user gave one, the exact `quote`, and the source.
- `inferences` (M7) hold conclusions with cited observation ids, confidence, model/run, status
  (proposed/accepted/rejected/expired), and an expiry.
- Accepting an inference never creates an observation. Operating-state variables are inferences.
- The UI labels them differently ("You said…" vs "LTS thinks…, because…").

## Consequences

- Review and suggestions can always show their evidence.
- Slightly more schema; the grounding check (quote must be in the capture) is cheap and
  deterministic.

## Clarification (2026-10-08)

A numeric scale the user fills in (mood, energy, stress, capacity) is an observation. It is
stored with the user's number and labeled subjective and self-reported. This decision still forbids
turning words into numbers, inferring a score or day mode from text, and presenting a self-reported
number as objective truth or diagnosis (Constitution, Amendment 3).
