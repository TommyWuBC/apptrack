# HANDOFF

## Current state
**M14 complete.** Analytics ingestion API: sites CRUD, public `POST /api/v1/analytics/events`, sessionization aggregate, retention, settings UI, INV-8 (no IP at rest).

## Last action taken
Implemented M14; core sessionize/hash tests, analytics route tests, INV-8 schema invariants, Playwright analytics settings — green.

## Next action
**M15 — Analytics SDK + example site** (`packages/analytics-sdk` → `/sdk.js`, `examples/website-astro`).
Or **M16 Correlation** after M15 (needs M9 + M15).

## Open blockers
- Docker Desktop (live DB for migrations 0001–0003 + ingest e2e).

## Gotchas
- Ingest stores visitor/geo context on events for deferred sessionization (`session_id` null until aggregate).
- Empty origin allowlist = any origin (dev); lock allowlist in production.
- Rate limits are in-memory (per process); fine at NFR-1 scale.
- Worker polls `/api/v1/analytics/aggregate` every 5m (`ANALYTICS_AGGREGATE_DISABLED=1` to stop).
- Playwright needs web `build` before `e2e`.

## Do not
- Persist raw IPs (INV-8).
- Fetch URLs from email/analytics content (INV-6).
- Commit secrets / real emails / `.env`.
