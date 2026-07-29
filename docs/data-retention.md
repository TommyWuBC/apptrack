# Data retention

Last verified against code: 2026-07-29 (M20).

apptrack is self-hosted: retention jobs run in the worker (`retention.cleanup`, daily
04:00 by default). Operators can adjust windows via environment variables where noted.

## Email content

### Normalized text (default)

Extracted plain text (`text_plain`, `text_full`) and `sanitized_html` are kept
**indefinitely** by default. They are the evidence trail for classifications and
timeline events. Users may purge individual messages locally; purge nulls bodies but
keeps the event skeleton for timeline integrity (audit-logged).

### Raw MIME (opt-in)

| Setting                   | Default | Behavior                                                       |
| ------------------------- | ------- | -------------------------------------------------------------- |
| `STORE_RAW_MIME`          | `false` | Raw MIME is not stored                                         |
| `RAW_MIME_RETENTION_DAYS` | `30`    | When enabled, encrypted `raw_encrypted` is nulled after N days |

Raw MIME is encrypted with the same AES-256-GCM key as OAuth tokens. See ADR-011.

### Optional body encryption at rest

`EMAIL_BODY_ENCRYPTION=on` encrypts normalized email bodies in the database. Backups
then omit plaintext bodies only if this flag was on for the entire retention period.

### Provider deletions

When Gmail reports a message deleted, apptrack sets `deleted_at_provider` but **keeps**
the local normalized copy so your timeline evidence does not vanish because Gmail
archived or deleted the thread. UI shows a "no longer in Gmail" indicator.

## OAuth credentials

Refresh and access tokens are retained until the user disconnects the Gmail account or
the account enters `reauth_required` and credentials are revoked. Disconnect deletes
credential rows.

## Sessions

Server-side sessions are deleted on logout or when absolute/idle expiry is reached
(configurable via `SESSION_ABSOLUTE_HOURS`, `SESSION_IDLE_HOURS`).

## Analytics

| Data                 | Default retention        | Override                   |
| -------------------- | ------------------------ | -------------------------- |
| `analytics_events`   | ~13 months (396 days)    | `ANALYTICS_RETENTION_DAYS` |
| `analytics_sessions` | Same as events           | `ANALYTICS_RETENTION_DAYS` |
| Visitor IP           | **Never stored** (INV-8) | —                          |

The retention job deletes rows older than the configured window. Site mode `off` stops new
ingest; existing rows age out on schedule.

## Notifications

In-app notifications with `read_at` set are trimmed after **90 days**. Unread
notifications are kept until read or account deletion.

## Classification and matching audit

`classification_results`, `application_match_candidates`, and `application_events` are
append-only for auditability. Reprocessing adds new versioned rows; it does not delete
historical inference records.

## Correlation predictions

Stored while the related application and session exist. Account deletion cascades
prediction rows.

## Audit log

Append-only locally. Retained until operator deletes the deployment or runs account
deletion (audit trail may be retained briefly for local forensics per deletion flow).

## Backups

Operators control backup retention on disk. Recommendations:

1. Encrypt with `scripts/backup.sh` (age). Store `age-key.txt` **offline**.
2. Treat `.dump.age` files as sensitive: they include email text and encrypted OAuth
   blobs (plaintext email unless `EMAIL_BODY_ENCRYPTION=on`).
3. Rotate backups on a schedule; test restore with `scripts/restore.sh` before relying
   on them.

See [docs/setup.md](./setup.md#backups-encrypted) for commands.

## Account deletion

`DELETE /account` (password re-entry required) removes user-owned rows, encrypted
blobs, and job payloads referencing the user. This is the primary GDPR-style erasure
path for self-hosters.

## Related documents

- [PRIVACY.md](../PRIVACY.md) — what is collected and what leaves the server
- [ADR-011](./adr/0011-store-extracted-text-sanitized-html.md) — raw MIME decision
- AGENTS.md §10.9 — normative retention register
