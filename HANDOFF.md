# HANDOFF

## Current state
**M7 complete.** Deterministic classification (L1+L2), golden eval F1≈0.97, sync auto-classify, `docs/classification.md`. M5–M7 verified green; pushed to GitHub.

## Last action taken
Implemented M7; ran full gate + eval; committed and pushed.

## Next action
**M8 — Application matching:** matcher signals/thresholds, `application.match` + review items, match_candidates audit.

Optional: Docker → live Postgres proof for M2/M4–M7 integration.

## Open blockers
- Docker Desktop (live DB proof).

## Gotchas
- Classifier `clf-2026.07.0` / rules `rules-2026.07.0` — bump on behavior change; update `fixtures/golden/baseline.json` in same PR.
- `pnpm eval` fails CI if core-type F1 < 0.85 or any type drops >2pts vs baseline.
- Prompt-injection canaries must stay `unknown` (do not follow body instructions).

## Do not
- Make LLM classification the default (L3 is M13, opt-in).
- Fetch URLs from email (INV-6).
- Commit real emails or `.env` secrets.
