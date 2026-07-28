# apptrack

Self-hostable, privacy-conscious job application tracker. It reads **your** email
(Gmail OAuth, readonly), classifies recruiting messages with a deterministic-first
pipeline, and maintains an auditable application timeline — confirmations, OAs,
interviews, rejections, offers, and possible ghosting — with confidence scores,
evidence, and human corrections that automation never overwrites.

Optional: embed a cookie-free analytics SDK on a personal site and score
*probabilistic* (never identifying) associations between anonymous visits and
applications.

**License:** [MIT](./LICENSE) · **Version:** 1.0.0 · **Code of conduct:** [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## Quickstart (local)

Requires Node 22, pnpm 9, and Docker (Postgres).

```bash
cp .env.example .env
# required: APP_ENCRYPTION_KEY, SESSION_SECRET, INTERNAL_JOB_SECRET
# generate: openssl rand -base64 32
pnpm install
pnpm migrate
pnpm demo    # synthetic owner + applications (no Google account needed)
pnpm dev
```

- Dashboard: http://localhost:5173 (first visit → `/setup` if not demo-seeded)
- API: http://localhost:3000/healthz · readiness `/readyz`
- Contributor path uses `EMAIL_PROVIDER=mock` — see [CONTRIBUTING.md](./CONTRIBUTING.md)

## Docker Compose (self-host)

```bash
cp .env.example .env   # fill secrets; set NODE_ENV=production for HSTS
docker compose up -d --build
# server entrypoint runs migrations automatically
```

Open http://localhost:3000 (API + built SPA when configured). Worker polls/jobs
via `APP_BASE_URL=http://apptrack-server:3000`. Ops: [docs/setup.md](./docs/setup.md),
encrypted backups [`scripts/backup.sh`](./scripts/backup.sh).

## Feature matrix

| Area | Status |
|------|--------|
| Gmail OAuth + incremental sync / backfill | ✅ |
| Mock email provider (no Google needed) | ✅ |
| Deterministic classification + optional LLM | ✅ (`CLASSIFIER_MODE`) |
| Matching, timeline, corrections, review | ✅ |
| Ghosting inference | ✅ |
| Dashboard SPA + stats | ✅ |
| Analytics ingest + SDK + example site | ✅ |
| Correlation (opt-in, medium-capped) | ✅ (`CORRELATION_ENABLED`) |
| Security headers, CSRF, threat model | ✅ |
| Encrypted backups, Dependabot, GHCR release | ✅ |

## Classifier eval (synthetic golden set)

From `pnpm eval` / `fixtures/golden/baseline.json` (classifier `clf-2026.07.2`, n=69):

| Metric | Value |
|--------|-------|
| Overall F1 | **0.972** |
| Precision | 0.985 |
| Recall | 0.986 |

Caveats: numbers are on **synthetic** ATS-style fixtures, not a personal mailbox.
Real-world recall will be lower; the review queue exists for misses. CI fails if
any event-type F1 drops >2 points vs this baseline.

## Demo

```bash
pnpm demo && pnpm dev
```

Storyboard for recording a GIF: [docs/demo-storyboard.md](./docs/demo-storyboard.md).

## Architecture

```
apps/web     ──► packages/shared (types) + REST only
apps/server  ──► packages/core / db / providers / shared
apps/worker  ──► packages/db / shared  (pg-boss → server internal API)
apps/cli     ──► packages/db / shared
```

Details: [ARCHITECTURE.md](./ARCHITECTURE.md) · blueprint: [AGENTS.md](./AGENTS.md) ·
threats: [THREAT_MODEL.md](./THREAT_MODEL.md) · privacy: [PRIVACY.md](./PRIVACY.md).

## Docs index

| Doc | Topic |
|-----|--------|
| [docs/setup.md](./docs/setup.md) | Install, auth, backups |
| [docs/gmail-oauth.md](./docs/gmail-oauth.md) | Google Cloud OAuth |
| [docs/classification.md](./docs/classification.md) | L0–L3 pipeline |
| [docs/correlation-model.md](./docs/correlation-model.md) | Visit ↔ application scoring |
| [docs/interview-preparation.md](./docs/interview-preparation.md) | Design Q&A |
| [CHANGELOG.md](./CHANGELOG.md) | Semver history |

## Semver

Breaking DB/API/config → major. Features → minor. Fixes → patch. Pre-1.0 history
is squashable; **1.0.0 freezes** the public REST + schema contracts under
additive-only rules (see AGENTS.md R-4 / I6-style discipline for shared schemas).

## Security

Report vulnerabilities privately — see [SECURITY.md](./SECURITY.md). Do not open
public issues for secrets or exploit PoCs against live instances.
