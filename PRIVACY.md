# Privacy Policy — apptrack

Last verified against code: 2026-07-29 (M20).

apptrack is **self-hosted software**. The operator (usually you) runs it on their own
machine or VPS. This document describes what the application stores and what may leave
your deployment. It does not replace your legal obligations as a site operator; adapt the
visitor-facing snippet in `examples/website-astro` for your portfolio site.

## Summary

| Data | Stored? | Leaves your server? |
| --- | --- | --- |
| Gmail email content | Yes (extracted text + optional raw MIME) | Only if you enable LLM `api`/`hybrid` classifier mode |
| OAuth tokens | Yes (encrypted) | To Google Gmail API only |
| Passwords | Yes (argon2id hash) | Never |
| Analytics visitor IP | **Never** (INV-8) | Never persisted |
| Analytics coarse geo | Optional | Never to third parties |
| LLM prompts | Only in `api`/`local` modes | To provider you configure |

There is no apptrack telemetry, phone-home, or shared cloud.

## What apptrack stores

### Account and sessions

- Email address and argon2id password hash for the owner account.
- Server-side session records (hashed token, expiry, coarse `ip_country` only — no raw IP).

### Gmail connection

- OAuth refresh and access tokens, **AES-256-GCM encrypted** at rest (`APP_ENCRYPTION_KEY`).
- Connected mailbox metadata (provider account email, sync cursor, backfill progress).

### Email content

Default retention (see [docs/data-retention.md](./docs/data-retention.md)):

- Message headers subset, subject, snippet, thread linkage.
- Normalized plain text (`text_plain`, `text_full`) and sanitized HTML.
- Attachment **metadata** only (filename, MIME, size, hash) — not attachment bodies except parsed `.ics` calendar text.
- Optional raw MIME (`STORE_RAW_MIME=true`), encrypted, with time-limited retention.

Email subjects, bodies, and addresses are **excluded from application logs** at info level.

### Job applications

- Companies, roles, applications, and an append-only event timeline.
- Classification results with confidence, evidence strings, and extraction fields.
- User corrections and field locks (automation never overwrites locked fields — INV-7).

### Analytics (optional)

If you enable analytics sites and embed the SDK on a portfolio site:

- Site key, origin allowlist, per-site mode (`full`, `no_geo`, `off`).
- Session records: daily-rotating `visitor_hash`, coarse geo (country/region/city when enabled), device/browser category, paths, UTM parameters.
- Event records: page views, custom events, optional `src_token` for unique application links.

**INV-8:** Raw IP addresses are never written to disk (database, logs, or files). The server computes `visitor_hash` and optional GeoLite2 lookup in memory, then discards the IP.

### Correlation (optional, off by default)

When `CORRELATION_ENABLED=true`, probabilistic scores link anonymous site visits to applications. Scores are capped at **medium** unless the visitor used a unique per-application link (deterministic path). The UI never claims to identify a recruiter or visitor by name.

## What leaves your server

### Google Gmail API

With a connected Gmail account, the worker calls Google's API using your OAuth tokens to sync mail (`gmail.readonly` scope). Google receives standard API requests; review [Google's privacy policy](https://policies.google.com/privacy) for their handling.

### LLM providers (opt-in only)

`CLASSIFIER_MODE` defaults to **`deterministic`**. No email content is sent to any AI provider in this mode.

| Mode | External calls | What is sent |
| --- | --- | --- |
| `deterministic` | None | — |
| `local` | Your Ollama endpoint (`OLLAMA_URL`) | Subject, stripped plain text (≤4,000 chars), sender display/domain |
| `api` | Anthropic and/or OpenAI (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) | Same minimal fields as local |
| `hybrid` | API only for low-confidence remainder after L1/L2 | Same minimal fields |

The settings UI discloses egress when non-deterministic modes are enabled. Adapters request no-retention flags where supported. Only structured extraction output is persisted — never chain-of-thought (INV-5).

### GeoLite2 database

If `GEOLITE2_DB_PATH` is set and site mode is `full`, MaxMind's GeoLite2 database is read locally. No IP is sent to MaxMind at query time (database is downloaded separately by the operator).

### Backups

Operators control backup destination. Use `scripts/backup.sh` (age encryption). Backups contain database contents including email text unless `EMAIL_BODY_ENCRYPTION=on`.

## Analytics visitor disclosure

If you embed `sdk.js` on a public website, disclose to visitors (example copy ships in `examples/website-astro`):

- **No cookies** and no localStorage identifiers in default mode.
- **No fingerprinting** (no canvas, fonts, audio, or similar).
- A **daily-rotating salted hash** identifies repeat visits within a day only; hashes do not link across days.
- **Coarse location** (country/region/city) may be derived from IP in memory when mode is `full`; IP is not stored.
- **Mode `no_geo`:** skips GeoLite2; may use a CDN country header if present.
- **Mode `off`:** SDK does nothing.

Events are sent to **your** apptrack instance, not to a third-party analytics vendor.

## Your rights (self-hosted)

- **Export:** `GET /export` or `apptrack export` — full JSON/CSV archive.
- **Delete:** account deletion removes user data, encrypted blobs, and job payloads referencing the user.
- **Correct:** edit or lock any field; automation respects corrections (INV-7).

## Security reporting

See [SECURITY.md](./SECURITY.md) for vulnerability disclosure.

## Changes

Material changes to data flows require updating this file and the "last verified" date. Check the git history and [CHANGELOG.md](./CHANGELOG.md) when upgrading.
