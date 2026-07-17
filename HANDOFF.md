# HANDOFF

## Current state
**M4 complete.** Gmail OAuth (PKCE connect/callback/disconnect/refresh), encrypted credential storage, `docs/gmail-oauth.md`, nock unit tests + INV-4 static guards. Integration OAuth tests skip without `DATABASE_URL`. See `PROGRESS.md`.

## Last action taken
Finished M4; ran `typecheck` / `lint` / `test` / `boundaries` / `test:fixtures` / `eval` (all green); committed and pushed to GitHub.

## Next action
**M5 — Incremental Gmail sync:** gmail adapter (`history` + backfill + fetch), `email.sync` / `email.backfill` jobs, cursor management, L0 prefilter hook, provider contract tests.

Optional beforehand: clear M2 ⚠️ with Docker migrate + db integration (unblocks M4 integration suite too).

## Open blockers
- Docker Desktop (blocks live Postgres proof for M2 + M4 integration tests).

## Gotchas
- Gmail routes register only when `APP_ENCRYPTION_KEY` + `GOOGLE_CLIENT_ID/SECRET` are set (or config injected in tests).
- Testing-mode Google consent expires refresh tokens ~7 days — see `docs/gmail-oauth.md`.
- Tokens never in API JSON (INV-4); encrypt in apps before `oauthCredentialsRepo`.

## Do not
- Import `googleapis` outside `packages/providers`.
- Store plaintext OAuth tokens.
- Start sync/history jobs without finishing OAuth credential path (already done).
- Commit real emails or `.env` secrets.
