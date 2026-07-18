# HANDOFF

## Current state
**M8 complete.** Application matching (`match-v1`): signals/thresholds, company resolution (no silent merges), `application.match` + `match.reevaluate`, match_candidates audit, review queue items. Sync pipeline: normalize → classify → match.

## Last action taken
Implemented M8; ran typecheck/lint/test/boundaries (green); docs `docs/application-matching.md`.

## Next action
**M9 — Timeline & state machine:** pure reducer, all states/transitions, `application.recompute`, corrections-overlay stub, timeline API. Replace M8’s minimal `stateForEvent` projection poke.

Optional: Docker → live Postgres proof for match persistence / review queue.

## Open blockers
- Docker Desktop (live DB proof). Integration tests skip without `DATABASE_URL`.

## Gotchas
- Matcher `match-v1` — bump on behavior change (R-8).
- Auto-attach requires score ≥ 0.75 **and** margin ≥ 0.2; otherwise review (never guess).
- Fuzzy company names ≥ 0.85 Jaro-Winkler → `entity_merge_suggestion`, not silent merge.
- Classifier `clf-2026.07.0` / rules `rules-2026.07.0` unchanged this milestone.
- `pnpm eval` still required if touching classification.

## Do not
- Silent company merges (§14.4).
- Fetch URLs from email (INV-6).
- Overwrite user corrections (INV-7) — corrections UI is M11; do not poke locked fields.
- Commit real emails or `.env` secrets.
