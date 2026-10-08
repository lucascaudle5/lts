# 0012. Room modules, typed signals, and no hidden coupling

Status: Accepted
Date: 2026-10-08

## Context

Every room except Today and a few forms currently lives in one 3,200-line file,
`src/app/(life)/LifeWorkspace.tsx`, and reads from a shared `WorkspaceData`. That works, but a room
cannot be changed, disabled, or removed without reading the rest. The historical design (see
[the history comparison](../history/LTS_conversation_history_vs_current_repo.md), "Recommended
synthesis" B) wanted rooms that stand alone and still say what they need from the rest of the
system, without writing into each other.

This is an addition to the stack-lock regime, not a stack change. Next.js, Supabase, Drizzle, zod,
and the proposal/mutation architecture are unchanged, and no new tables or libraries are needed.

## Decision

1. **Modularity goal.** Working on a room should leave it more independently removable than before.
   Each room that is touched is gradually extracted from `LifeWorkspace.tsx` into a module folder,
   for example `src/modules/<room>/` with `contracts`, `domain`, `signals`, `queries`, `mutations`,
   `components`, and `tests`. The folder shape is guidance, not a mandate. Do not rewrite a room only
   to move it, and do not extract rooms nobody is working on.
2. **Signals are a typed derived view.** A module exports functions such as `getHabitSignals` and
   `getTaskSignals` that read the module's data and return typed signals. Signals are not an event
   bus, not pub/sub, and not stored events. They are recomputed from recorded facts, cite the
   records they came from, and are never saved as observations (ADR 0006). Illustrative shape, to be
   fixed by the first implementation (Habits):

   ```ts
   interface Signal {
     kind: SignalKind;
     source: ModuleId; // the module that emitted it
     subject: { type: string; id: string };
     date?: IsoDate; // a local date key
     evidenceIds: string[];
   }
   ```

3. **Signal vocabulary:** `needs_time`, `needs_attention`, `needs_protection`, `needs_recovery`,
   `overdue`, `conflict`, `capacity_warning`, `upcoming_deadline`, `routine_candidate`,
   `review_candidate`. A new kind needs a day where its absence hurt (Article 5). These are internal
   names; user-facing copy still follows Article 4 (for example Today says "Waiting since…", not
   "overdue").
4. **Topology.**
   - **Schedule** owns time.
   - **Today** owns execution.
   - **Review** owns governance.
   - **History** owns the factual record.
   - **Archive** owns inactive state.
   - **Settings** owns constraints and permissions.
   - **NOVA** interprets, and acts only within the authority Settings grants.
   - **Capture** owns messy input.
   - **Sandbox** owns hypothetical state.
   - Other rooms own their domain data and emit signals to the layers above.
5. **Disabling a module** hides it and stops its signals. Its data is kept (and stays in History and
   exports).
6. **No hidden coupling.** A module never silently mutates another module's state. A signal asks;
   it does not write. Any change in another module's data is a visible, attributed mutation through
   `runMutations` (a confirmed proposal, an authorized direct command, or a manual edit), recorded in
   History.
7. **Boundaries.** Module code may import `contracts` and `domain`. It reaches the database only
   through `src/server/**` and writes only through `runMutations`. Modules reach each other only
   through exported signal functions and contracts, not through each other's internals. The import
   lint rules are extended when the first module exists, as part of that change.

## Consequences

- Each touched room gets smaller and testable alone, and the signal functions are unit-testable
  without a database.
- Two layouts coexist while rooms are extracted gradually. That is accepted. The tests stay the
  safety net, and `docs/MODULE_PARITY.md` tracks which rooms are done.
- The signals contract is built with the first module (Habits). If that proves too coupled or too
  heavy, supersede this ADR; do not grow it into an event system.
- The mutation layer remains the only writer, so signals cannot become a way around Article 9.
