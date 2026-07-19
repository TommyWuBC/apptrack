# HANDOFF

## Current state
**M1–M15 implemented + stabilization pass in progress on `cursor/stabilize-m1-m15-6a25`.** Auth sessions/CSRF, pg-boss queues, analytics incremental session fixes, review/reprocess/mark-irrelevant, ATS L1 templates, CLI/seed/migrate:down, CI/deps remediation.

## Last action taken
Continued post-audit hardening: fail-closed auth without DB, Gmail account ownership + disconnect audit + post-OAuth sync kick, worker `APP_BASE_URL` in Compose, effective classification overlays (INV-7), superseded-event match idempotency, uncertain_classification review creation/confirm, analytics site ownership + out-of-order session attach fix, demo seed uses `manual_override`, normalize→classify→match job chaining.

## Next action
**Finish verification on this branch** (`pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm eval`), update PR #9, then start **M16 — Correlation scoring**.

## Open blockers
- Live Postgres (Docker) still needed for full migration round-trip / OAuth integration tests; unit/CI path runs without it.
- Full transactional pg-boss enqueue on ingest (sync still runs normalize/classify/match inline) needs an ADR if kept as the long-term model.

## Gotchas
- Default `JOBS_MODE=boss`; worker calls server with `x-apptrack-internal` (`INTERNAL_JOB_SECRET`). Compose sets `APP_BASE_URL=http://apptrack-server:3000` for the worker.
- Protected mutations need session cookie + `X-CSRF-Token`.
- Production requires distinct `SESSION_SECRET` and `INTERNAL_JOB_SECRET`.
- SDK gzip gate in `packages/analytics-sdk`; CI runs `pnpm e2e:sdk`.

## Do not
- Persist raw IPs (INV-8).
- Fetch URLs from email/analytics content (INV-6).
- Commit secrets / real emails / `.env`.
- Silent company merges; overwrite locked fields (INV-7).
