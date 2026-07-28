# Architecture

Last verified against code: 2026-07-29 (v1.0.0 / M20).

apptrack is a TypeScript modular monolith. The Fastify server owns HTTP and
orchestration, the worker owns pg-boss consumers and schedules, the React SPA
talks only to REST contracts, and PostgreSQL stores both product data and jobs.

## Dependency direction

```text
web ───────────────► shared
server ─► core / db / providers / shared
worker ─► db / shared
cli ────► db / shared
core ───────────────────────────► shared
db ─────────────────────────────► shared
providers ──────────────────────► shared
```

`pnpm boundaries` enforces these edges. Core contains pure classification,
normalization, matching, state reduction, ghosting, and analytics identity
logic. SQL remains in `packages/db`; provider SDKs remain in
`packages/providers`.

## Runtime components

- `apps/server`: Fastify API, DB-backed owner sessions, double-submit CSRF,
  Gmail OAuth, dashboard APIs, analytics ingest, and `/sdk.js`.
- `apps/worker`: pg-boss workers and UTC schedules. `JOBS_MODE=http` retains the
  old interval pollers as a rollback mode.
- `apps/web`: Vite/React dashboard with setup/login, review, corrections,
  timeline evidence, settings, and analytics site administration.
- `apps/cli`: owner creation, sync/backfill/reprocess enqueue, and privacy-safe
  JSON export.
- `packages/analytics-sdk`: dependency-free browser tracker, size-gated below
  2 KB gzip.

## Email pipeline

```text
Gmail/mock provider
  → email.sync / email.backfill
  → idempotent email_messages insert
  → normalize
  → classify (L0–L3, versioned)
  → match
  → append application_event
  → recompute projection
```

Every stage uses a natural key. Reprocessing reads local normalized content and
appends replacement events only when the classification outcome changes.

Current limitation: sync still performs normalize/classify/match inline because
the database design does not persist a queue-safe normalization input when raw
MIME storage is disabled. Moving that handoff fully into separate pg-boss jobs
requires an ADR resolving whether encrypted transient MIME or another staging
representation is retained. Scheduled work and manual triggers are already
queue-backed.

## Event-sourced applications

`application_events` is the source of truth. The pure reducer orders events by
occurrence/ingest time and writes `applications` as a projection. User
corrections are overlaid after machine reduction; active corrections therefore
survive reprocessing (INV-7). Reattach, split, merge, and reprocess operations
append new audit events and only update `superseded_by` on replaced events.

## Security and privacy

- Passwords use Argon2id; only SHA-256 session-token hashes are stored.
- Session cookies are `httpOnly`, `SameSite=Lax`, and secure in production.
- Every protected mutation requires a session-bound CSRF token.
- OAuth tokens are AES-256-GCM encrypted and excluded from generic exports.
- Email HTML is sanitized and rendered in a sandboxed iframe.
- Analytics IPs are used in memory for daily hashes/local GeoLite2 lookup and
  never persisted (INV-8).
- App-wide CSP / frame denial / optional HSTS; Pino redacts tokens and email
  body fields (see `THREAT_MODEL.md`).
- LLM egress is opt-in; deterministic classification remains complete.

## Analytics

The public endpoint validates batches, applies origin/rate limits, computes a
daily visitor hash, and inserts only. `analytics.aggregate` merges incremental
events into the latest 30-minute session before creating a new one. Retention
removes old analytics, expired raw MIME, old read notifications, and expired
auth sessions.

The example Astro site is exercised directly by Playwright while a small
tracker harness serves the real SDK bundle and records API calls.

## Correlation (`corr-v1`)

Off by default (`CORRELATION_ENABLED`). After sessionization, `correlation.score`
pairs applications with anonymous sessions using transparent rules. Probabilistic
confidence is capped at **medium**; **high** requires a unique `?src=` / tracked
résumé token. Explanations are plain language with banned identification phrases.
See `docs/correlation-model.md`.
