# Ghosting inference

Last verified against code: 2026-07-19 (M12).

## Model

Ghosting is an **inference**, never a fact. Projection field `applications.ghost_status`:

| Status             | Meaning                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `none`             | Active / within window                                                     |
| `stale`            | Past stale threshold; current_state unchanged                              |
| `possibly_ghosted` | Past ghost threshold; `ghost_flagged` projects `current_state` → `ghosted` |
| `dismissed`        | User dismissed; suppressed until state changes                             |

Algorithm version: `ghost-v1` (`packages/core/ghosting`).

## Thresholds (defaults)

- Stale: **45** days since last meaningful event
- Possibly ghosted: **90** days
- Per-stage overrides (built-in): `final_round` 21/45, `interviewing` & `recruiter_screen` 30/60
- Per-type / per-company overrides via `user_settings.ghost_thresholds`
- Precedence: **company > type > stage > default**

## Semantics

1. **Pause** while a future interview datetime or OA deadline exists (`ghostInputs.hasFutureScheduled`).
2. **Reset** on any meaningful event (recompute auto-emits `ghost_cleared`).
3. **Terminal** states (`offer`, `rejected`, `withdrawn`) never ghost.
4. **Dismiss** stores `dismissedAtState` on `ghost_dismissed`; re-flagging waits for a state change.
5. Notification + `ghost_confirm` review item only at the **possibly_ghosted** threshold.

## API

| Method    | Path                                     | Purpose                      |
| --------- | ---------------------------------------- | ---------------------------- |
| GET       | `/api/v1/ghost/version`                  | Algorithm version + defaults |
| POST      | `/api/v1/ghost/evaluate`                 | Scan all apps for a user     |
| POST      | `/api/v1/ghost/evaluate/:applicationId`  | Single app                   |
| POST      | `/api/v1/applications/:id/ghost/dismiss` | User dismiss                 |
| GET/PATCH | `/api/v1/settings/ghost`                 | Threshold settings           |
| GET       | `/api/v1/notifications`                  | In-app notifications         |
| POST      | `/api/v1/notifications/:id/read`         | Mark read                    |

Worker polls `POST /api/v1/ghost/evaluate` daily (disable with `GHOST_EVAL_DISABLED=1`).

## UI

- Applications table / overview: dashed **stale** / _possibly ghosted_ badges
- Application detail: banner + one-click dismiss
- Settings: threshold editors + “Run ghost evaluate now”
- Review queue: `ghost_confirm` items
