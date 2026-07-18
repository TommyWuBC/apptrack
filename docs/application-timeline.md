# Application timeline & state machine

Last verified against code: 2026-07-18 (M9).

## Model

`application_events` is the append-only source of truth (INV-9).  
`applications.current_state` is a **projection** recomputed by a pure reducer.

```
events (ordered) ──► reduce() ──► overlay corrections (stub) ──► projection
```

## Reducer version

`state-v1` (`REDUCER_VERSION` in `packages/core/src/statemachine/version.ts`). Bump on behavior change (R-8).

## Ordering

Events sorted by `(occurred_at, ingested_at, id)`. Superseded events (`superseded_by` set) are skipped. Late/backfilled mail just inserts + recompute — no special cases.

## States

`draft`, `applied`, `confirmation_received`, `assessment_received`, `assessment_completed`, `recruiter_screen`, `interviewing`, `final_round`, `offer`, `rejected`, `withdrawn`, `ghosted`, `on_hold`, `unknown`.

Terminal-ish (`offer`, `rejected`, `withdrawn`) are **reopenable** — e.g. rejection then recruiter outreach → `recruiter_screen` with `flags.reopened`.

## Notable transitions

| Event | Effect |
|-------|--------|
| `application_confirmation` | → `confirmation_received` |
| `oa_invitation` / `oa_reminder` | → `assessment_received` (+ action on invite) |
| `interview_*` | → `interviewing` (or `final_round` if payload hints) |
| `interview_cancelled` | pop to prior stage |
| `waitlist_or_freeze` | → `on_hold` |
| `rejection` / `offer` / `withdrawal_confirmation` | terminal-ish states |
| `manual_override` | payload.state wins |
| same-day reject + interview/offer | both kept; `flags.conflict` (F14) → review item |

## Corrections overlay (stub)

`applyCorrections(machine, corrections)` — locked/corrected fields win (INV-7). Full review/merge UX is M11.

## API

| Method | Path |
|--------|------|
| GET | `/api/v1/applications/reducer-version` |
| GET | `/api/v1/applications?userId=` |
| GET | `/api/v1/applications/:id` |
| GET | `/api/v1/applications/:id/timeline` |
| POST | `/api/v1/applications/:id/recompute` |

Match attach/create calls `recomputeApplication` after appending events (replaces M8’s one-shot `stateForEvent`).

## Tests

```bash
pnpm --filter @apptrack/core test
pnpm --filter @apptrack/server test
```

Property: any event permutation ⇒ same final state when sorted. Also reopen-after-rejection, conflict flagging, corrections stub.
