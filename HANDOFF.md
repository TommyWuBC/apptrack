# HANDOFF

## Current state
**v1.0.0 ready on `agent/cursor/m17-security-hardening`** (includes M17–M20). Open-source packaging, docs, acceptance checklist, migrate-on-start Docker entrypoint, packaging CI smoke. Product is usable in mock/demo mode without Google; owner dogfooding (§37.1) remains for live Gmail.

## Last action taken
Completed M18–M20: MIT LICENSE + D-9 (keep apptrack), CONTRIBUTING/CoC/PRIVACY/CHANGELOG, ADRs 0005–0013, issue/PR templates, GHCR release workflow, README eval table, interview-prep + data-retention + v1-acceptance, server migrate entrypoint. Verified typecheck/lint/test/eval/boundaries/prod-audit/packaging.

## Next action
**Human:** commit + push this branch (commands provided in chat); open PR into your preferred base; tag `v1.0.0` after merge to trigger release.yml. Then optional owner dogfooding (§37.1) with real Gmail.

## Open blockers
- Local `main` vs `origin/main` still duplicated histories — merge via PR, no force-push.
- CSRF integration + full migrate round-trip need live Postgres (`DATABASE_URL`).
- Windows `pnpm format:check` noisy on CRLF for untouched files.

## Gotchas
- Compose: server runs `pnpm migrate` on start via `scripts/docker-entrypoint-server.sh`.
- `CORRELATION_ENABLED=false` by default; enable only with analytics configured.
- Tag must match CHANGELOG section (`v1.0.0` ↔ `## [1.0.0]`).
- Rebuild workspace packages if `dist/` is stale before server tests.

## Do not
- Force-push `main`.
- Commit secrets / real emails / `.env`.
- Push or create the git tag without the owner running the provided commands.
- Claim recruiter identification in UI copy.
