# HANDOFF

## Current state
**M16 Correlation scoring implemented on `cursor/m16-correlation-scoring-6a25`** (branched from stabilize). `corr-v1` pure scorer, predictions/features repos, unique links + tracked résumé, feedback API, worker job, SPA panel, docs.

## Last action taken
Landed M16: core scoring + banned-phrase tests; DB `user_resumes` migration; server routes/services; aggregate→`correlation.score` enqueue; web CorrelationPanel + demo stubs; `docs/correlation-model.md`.

## Next action
**Verify** (`pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm eval && pnpm boundaries`), then open/update PR with base `cursor/stabilize-m1-m15-6a25`. After merge: **M17 Security hardening**.

## Open blockers
- Live Postgres still needed for full migration round-trip / OAuth integration tests.
- Transactional pg-boss handoff for ingest (still inline normalize/classify/match) needs ADR if kept long-term.

## Gotchas
- `CORRELATION_ENABLED=false` by default; enable only with analytics configured.
- Probabilistic band hard-capped at medium; high requires unique link / tracked résumé token.
- Explanations must not use banned identification phrases (`packages/core/src/correlation/language.ts`).
- Tracked résumé needs `POST /api/v1/resume` upload first; public route is `GET /r/:token/resume.pdf`.

## Do not
- Persist raw IPs (INV-8).
- Claim recruiter identification in UI copy.
- Fetch URLs from email/analytics content (INV-6).
- Commit secrets / real emails / `.env`.
