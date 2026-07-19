# HANDOFF

## Current state
**M11 complete.** Corrections precedence (INV-7), review queue UI + resolve API, merge/split/reattach, company merge, locks/undo, audit_log. Recompute loads corrections from DB.

## Last action taken
Implemented M11; gate + Playwright (incl. review + corrections panel) green.

## Next action
**M12 — Ghosting:** §17 evaluate job, thresholds settings UI, notifications, pause/reset/dismiss matrix.

## Open blockers
- Docker Desktop (live DB proof for merge/split roundtrip + INV-7 persistence).

## Gotchas
- Demo mode persists via `sessionStorage` after `?demo=1` so client-side navigations keep fixtures.
- Undo = `reverted_at`; earlier corrections for the same field remain active.
- Event reattach: new event + `superseded_by` on old (only allowed event mutation).
- Review resolve body is a tagged union by `kind`.
- Playwright: `pnpm --filter @apptrack/web e2e`.

## Do not
- Silent company merges (§14.4).
- Overwrite locked fields from automation (INV-7).
- UPDATE/DELETE `application_events` except `superseded_by`.
- Commit real emails or `.env` secrets.
