# HANDOFF

## Current state
**M10 complete.** Dashboard SPA: overview / applications / timeline / companies / stats / settings stub; typed API client; sandboxed evidence viewer; small-sample stats guard; demo fixtures (`?demo=1`). Server: `/api/v1/stats`, `/companies`, `/emails/:id/evidence`, `/me`.

## Last action taken
Implemented M10; ran M8–M10 tests + full gate (typecheck/lint/test/boundaries) + Playwright demo smoke — green. Fixed client↔demo circular import.

## Next action
**M11 — Manual corrections & review:** corrections precedence (INV-7 UI), review queue UI, merge/split, reattach, locks, undo, audit_log.

## Open blockers
- Docker Desktop (live DB proof). Integration tests skip without `DATABASE_URL`.

## Gotchas
- SPA demo: `?demo=1` or `VITE_DEMO=1` — offline navigable without Postgres.
- Review route intentionally omitted (M11). Analytics settings deferred (M14).
- Small-sample: n < 10 → n/N, never bold % (`RateStatDisplay` + server `rateStat`).
- Evidence iframe uses `sandbox=""` (T4); HTML sanitized on ingest.
- Playwright: `pnpm --filter @apptrack/web e2e` (needs Chromium once via `playwright install chromium`).

## Do not
- Add review/corrections UI here (M11).
- Fetch URLs from email (INV-6).
- Commit real emails or `.env` secrets.
- Reintroduce circular imports under `apps/web/src/api/`.
