# Gmail incremental sync

Last verified against code: 2026-07-17 (M5).

## Modes

| `EMAIL_PROVIDER` | Behavior                                                                     |
| ---------------- | ---------------------------------------------------------------------------- |
| `mock` (default) | Replays `fixtures/emails` via `MockEmailProvider` — no Google account needed |
| `gmail`          | Live Gmail API using encrypted OAuth tokens from M4                          |

## Algorithm (incremental)

1. Load account; exit if not `active`.
2. Refresh access token if near expiry (`invalid_grant` → `reauth_required`, no retry loop).
3. If `sync_cursor` is null → bounded **backfill** (default last 180 days, max 500 msgs/chunk), then set mailbox cursor.
4. Else `history.list(startHistoryId)`:
   - For each added id: **metadata** fetch → L0 prefilter → full fetch if needed → idempotent insert.
   - Tombstone deletions (`deleted_at_provider`).
5. On history **404** (expired): re-list messages since `last_sync_at − 7d`, then reset cursor from profile (F1).
6. Advance `sync_cursor` only after the batch succeeds.

Normalize enqueue is collected as `normalizeQueued` message ids; the `email.normalize` job lands in M6 (pg-boss transactional handoff).

## API

| Method | Path                  | Body / query                              |
| ------ | --------------------- | ----------------------------------------- |
| POST   | `/api/v1/sync/run`    | optional `{ accountId }`                  |
| GET    | `/api/v1/sync/status` | optional `?accountId=`                    |
| POST   | `/api/v1/backfill`    | `{ afterDate, accountId?, maxMessages? }` |

## Worker

`apps/worker` polls active accounts every `SYNC_POLL_INTERVAL_MS` (default 10 minutes) and runs `email.sync`.
