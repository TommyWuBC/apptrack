# Setup

Last verified against code: 2026-07-28 (M17).

## Prerequisites

- Node.js 22 LTS
- pnpm 9 (`npm install -g pnpm@9`)
- Docker (for Postgres + Mailpit)

## Quickstart

```bash
cp .env.example .env
# required: APP_ENCRYPTION_KEY, SESSION_SECRET, INTERNAL_JOB_SECRET
# generate keys: openssl rand -base64 32
pnpm install
pnpm migrate
pnpm demo    # optional synthetic owner + applications
pnpm dev
```

- SPA: http://localhost:5173 (first visit → `/setup` if no owner)
- Health: http://localhost:3000/healthz · ready: `/readyz` (DB + pg-boss)
- Mailpit UI: http://localhost:8025

`pnpm dev` starts Docker Postgres/Mailpit, then server + worker + Vite. It does **not** auto-migrate or auto-seed — run those manually once.

## Auth

- First owner: SPA `/setup` or `apptrack user:create --email … --password …` (≥12 chars).
- Session cookie `apptrack_session` (httpOnly) + CSRF cookie `apptrack_csrf`.
- Mutations need header `X-CSRF-Token` matching the CSRF cookie (token also returned from login/setup/`GET /api/v1/auth/me`).
- Worker → server jobs: header `x-apptrack-internal: $INTERNAL_JOB_SECRET`.
- Production requires `INTERNAL_JOB_SECRET` distinct from `SESSION_SECRET`.

## Jobs

- Default `JOBS_MODE=boss` (pg-boss). Set `JOBS_MODE=http` to fall back to interval HTTP pollers.
- Compose production worker sets `APP_BASE_URL=http://apptrack-server:3000`.

## Database

```bash
docker compose -f docker-compose.dev.yml up -d postgres
pnpm migrate           # 0000–0003
pnpm migrate:down      # rolls back latest additive migration (not 0000)
```

Integration tests: `DATABASE_URL=... pnpm --filter @apptrack/db test` (skipped if Postgres unreachable).

OAuth tokens are encrypted with AES-256-GCM in `packages/core/crypto` before the dedicated `oauthCredentials` repo stores bytea only (INV-1).

## Backups (encrypted)

Install [age](https://github.com/FiloSottile/age) and `pg_dump` / `pg_restore`.

```bash
# Generate an age identity (keep age-key.txt offline)
age-keygen -o age-key.txt
# Public recipient is printed / in the file as "# public key: age1..."

export DATABASE_URL=postgres://...
export BACKUP_AGE_RECIPIENT=age1...   # public key
./scripts/backup.sh ./backups

# Restore (destructive)
export BACKUP_AGE_IDENTITY=./age-key.txt
./scripts/restore.sh ./backups/apptrack-YYYYMMDD….dump.age
```

Dumps include encrypted OAuth blobs but **plaintext email text** unless `EMAIL_BODY_ENCRYPTION=on`. Treat `.dump.age` files as sensitive.

## Security headers

Production (`NODE_ENV=production`) or `ENABLE_HSTS=true` sends `Strict-Transport-Security`. All responses include CSP (`frame-ancestors 'none'`), `X-Frame-Options: DENY`, and `nosniff`. See `THREAT_MODEL.md`.

## Local CI-ish check

```bash
pnpm boundaries && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm eval
```
