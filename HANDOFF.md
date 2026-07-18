# HANDOFF

## Current state
**M9 complete.** Event-sourced timeline + pure reducer (`state-v1`), `application.recompute`, corrections-overlay stub (INV-7), timeline API. Match attach/create now recomputes projection instead of `stateForEvent`.

## Last action taken
Implemented M9; typecheck/lint/test/boundaries green; docs `docs/application-timeline.md`.

## Next action
**M10 — Dashboard:** SPA routes per §19 (except review/settings-analytics); typed API client; evidence viewer (sandboxed); stats with small-sample guard.

Optional: Docker → live Postgres proof that delete-projection + recompute yields identical state (INV-9).

## Open blockers
- Docker Desktop (live DB proof). Integration tests skip without `DATABASE_URL`.

## Gotchas
- Reducer `state-v1` — bump on behavior change (R-8).
- Matcher `match-v1` unchanged this milestone.
- Same-day reject + interview → `flags.conflict` + `state_conflict` review item; events never dropped (F14).
- Corrections overlay is a **stub** — full lock/undo/merge UX is M11.
- Ghost evaluation job is M12; reducer only handles ghost_flagged/cleared events if present.

## Do not
- Mutate `application_events` (INV-9) — reattach via new event + `superseded_by`.
- Silent company merges (§14.4).
- Fetch URLs from email (INV-6).
- Commit real emails or `.env` secrets.
