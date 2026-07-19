# Manual corrections & review

Last verified against code: 2026-07-19 (M11).

## Precedence (INV-7)

`user-locked > user-corrected > machine projection`

`applyCorrections` / `activeCorrections` in `packages/core/statemachine`. Recompute always loads `user_corrections` from DB and overlays before writing `applications.current_state`.

Undo = set `reverted_at` (append-only). Earlier corrections for the same field remain eligible.

## API

| Method | Path | Purpose |
|--------|------|---------|
| PATCH | `/api/v1/applications/:id` | Field corrections (+ `manual_override` for state) |
| GET | `/api/v1/applications/:id/corrections` | List correction rows |
| POST | `/api/v1/corrections/:id/undo` | Revert correction |
| POST | `/api/v1/applications/:id/merge` | Merge source apps into survivor |
| POST | `/api/v1/applications/:id/split` | Peel events into new application |
| POST | `/api/v1/applications/:id/events/:eventId/reattach` | Move one event |
| GET | `/api/v1/review` | Open queue |
| POST | `/api/v1/review/:id/resolve` | Tagged-union resolution |
| POST | `/api/v1/companies/merge` | Manual company merge |

All state-changing paths write `audit_log`.

## Review resolution kinds

- `ambiguous_match`: `attach` \| `new_application` \| `dismiss`
- `entity_merge_suggestion`: `merge` \| `dismiss`
- `state_conflict`: `accept_state` (+ lock) \| `dismiss`
- others: `dismiss` \| `confirm`

## UI

- `/review` — queue with one-click actions
- Application detail — `CorrectionsPanel` (stage + lock + undo)
- `/companies` — manual merge form

Demo: `?demo=1` includes sample review items + a locked correction.
