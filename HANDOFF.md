# HANDOFF

## Current state
**M12 complete.** Ghost inference (`ghost-v1`): thresholds, pause/reset/dismiss, evaluate job API, notifications, settings UI, dashed ghost badges.

## Last action taken
Implemented M12; core matrix tests + server routes + Playwright ghost dismiss green.

## Next action
**M13 — Optional LLM extraction** (∥-safe with M14 after M7/M2 deps): llm adapters, L3, arbitration, canaries.
Alternatively **M14 Analytics ingestion** (depends M2 only).

## Open blockers
- Docker Desktop (live DB proof for ghost.evaluate end-to-end + migration 0001).

## Gotchas
- `ghost_status` is separate from `current_state`; only `possibly_ghosted` emits `ghost_flagged` that projects to `ghosted` (stale uses `level: "stale"` and does not change state).
- Dismiss stores `dismissedAtState`; re-flagging waits for a state change.
- Recompute auto-clears stale/ghosted when activity returns (`skipGhostEvaluate` avoids recursion).
- Worker calls `POST /api/v1/ghost/evaluate` (no cross-app import); disable with `GHOST_EVAL_DISABLED=1`.
- Playwright e2e needs `pnpm --filter @apptrack/web build` before `e2e` (preview serves dist).
- Demo mode: `?demo=1` → sessionStorage.

## Do not
- Treat ghost as identification / hard fact in UI copy.
- Silent company merges.
- Overwrite locked fields (INV-7).
- UPDATE/DELETE `application_events` except `superseded_by`.
- Commit real emails or `.env` secrets.
