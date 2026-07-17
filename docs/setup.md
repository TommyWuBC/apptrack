# Setup

Last verified against code: 2026-07-17 (M2 database).

## Prerequisites

- Node.js 22 LTS
- pnpm 9 (`npm install -g pnpm@9`)
- Docker (for Postgres + Mailpit)

## Quickstart

```bash
cp .env.example .env
# fill APP_ENCRYPTION_KEY and SESSION_SECRET
pnpm install
pnpm dev
```

- API: http://localhost:3000/api/v1/hello  
- SPA: http://localhost:5173  
- Health: http://localhost:3000/healthz  
- Mailpit UI: http://localhost:8025  

## Database (M2+)

```bash
docker compose -f docker-compose.dev.yml up -d postgres
cp .env.example .env   # set DATABASE_URL, APP_ENCRYPTION_KEY, SESSION_SECRET
pnpm migrate           # applies packages/db/src/migrations
```

Integration tests: `DATABASE_URL=... pnpm --filter @apptrack/db test` (skipped if Postgres unreachable).

OAuth tokens are encrypted with AES-256-GCM in `packages/core/crypto` before the dedicated `oauthCredentials` repo stores bytea only (INV-1).
