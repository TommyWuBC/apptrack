# Contributing to apptrack

Thank you for your interest in apptrack — a self-hostable, privacy-conscious job
application tracker that builds your pipeline from Gmail. This guide covers local
setup, development workflow, and pull request expectations.

The authoritative architecture blueprint is [AGENTS.md](./AGENTS.md). Read it
before changing behavior in `packages/core`, `packages/db`, or API contracts.

## Prerequisites

- Node.js 22 LTS
- pnpm 9 (`corepack enable` or `npm install -g pnpm@9`)
- Docker (Postgres 16 + Mailpit for local dev)

## Quick setup (mock Gmail — no Google account required)

Contributors should **never** need a real Gmail account. CI and local dev use the
mock email provider.

```bash
git clone https://github.com/<org>/apptrack.git
cd apptrack
cp .env.example .env
# Generate secrets: openssl rand -base64 32
# Set APP_ENCRYPTION_KEY, SESSION_SECRET, INTERNAL_JOB_SECRET in .env

pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm migrate
pnpm demo          # optional: synthetic applications + events
pnpm dev
```

Ensure `.env` contains:

```env
EMAIL_PROVIDER=mock
CLASSIFIER_MODE=deterministic
```

- Dashboard: http://localhost:5173
- API health: http://localhost:3000/healthz
- Mailpit (synthetic mail UI): http://localhost:8025

See [docs/setup.md](./docs/setup.md) for production Compose, backups, and OAuth.

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Postgres/Mailpit + server + worker + Vite |
| `pnpm test` | Unit and integration tests (all packages) |
| `pnpm typecheck` | TypeScript across the monorepo |
| `pnpm lint` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm boundaries` | dependency-cruiser module boundary check |
| `pnpm migrate` / `pnpm migrate:down` | Drizzle migrations |
| `pnpm eval` | Golden classifier metrics (regression gate) |
| `pnpm fixtures:generate` | Regenerate synthetic `.eml` fixtures |
| `pnpm demo` | Seed screenshot-safe demo data |

Run the full local CI check before opening a PR:

```bash
pnpm boundaries && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm eval
```

## Project structure (short)

```
apps/server   — Fastify API + serves SPA + /sdk.js
apps/worker   — pg-boss job consumers
apps/web      — React SPA
apps/cli      — `apptrack` admin CLI
packages/shared — zod schemas, enums (zero internal deps)
packages/core   — pure domain logic (no I/O)
packages/db     — Drizzle schema, migrations, repos
packages/providers — Gmail + mock email adapters
```

Dependency direction is enforced in CI. Do not cross boundaries — restructure
instead. See AGENTS.md §9.

## Fixture rules (R-10)

All email fixtures under `fixtures/emails/` must be **synthetic**. Never commit:

- Real personal emails, names, or addresses
- OAuth tokens, API keys, or `.env` files
- Screenshots or exports from a real mailbox

Use `scripts/generate-fixtures.ts` or `apptrack fixtures:add --scrub` (when
available) to create new fixtures from templates. Golden baseline metrics live
in `fixtures/golden/`; updating them requires a DEVLOG note when classification
behavior intentionally changes.

## Making changes

1. **Pick a focused scope** — one milestone area per PR when possible.
2. **Contracts first** — changes to `packages/shared` or DB schema may need to
   land before dependent work (AGENTS.md §29.1).
3. **Tests required** — behavior changes need tests in the same PR (R-5).
4. **Version bumps** — normalize/classify/match/reducer changes bump their
   version string (R-8).
5. **No secrets** — gitleaks runs in CI; use `.env.example` placeholders only.

### Classification or matching changes

Run `pnpm eval` and include the delta in your PR description. CI fails if any
event-type F1 drops more than 2 points vs `fixtures/golden/baseline.json`.

### Migrations

Migrations must be backward-compatible with the previous release (R-16). Test
`pnpm migrate` and `pnpm migrate:down` locally when you add one.

## Pull request process

1. Fork and create a branch (`feat/…`, `fix/…`, `docs/…`).
2. Fill out the [pull request template](.github/PULL_REQUEST_TEMPLATE.md).
3. Ensure CI is green (lint, typecheck, test, boundaries, eval, gitleaks).
4. Link related issues and milestone (M1–M20) when applicable.
5. A maintainer will review for AGENTS.md alignment, invariants (INV-*), and
   privacy/security impact.

Breaking API or schema changes need an ADR in `docs/adr/` and a DEVLOG entry
per AGENTS.md R-13/R-4.

## Security

Report vulnerabilities privately — see [SECURITY.md](./SECURITY.md). Do not
open public issues for security bugs.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be
respectful and constructive.

## Questions

- Architecture and invariants: [AGENTS.md](./AGENTS.md)
- Self-hosting: [docs/setup.md](./docs/setup.md)
- Gmail OAuth (optional): [docs/gmail-oauth.md](./docs/gmail-oauth.md)
- Privacy: [PRIVACY.md](./PRIVACY.md)
