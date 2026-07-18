# Application matching

Last verified against code: 2026-07-18 (M8).

## Purpose

After an email is classified as job-related, attach it to the right application, create a new one, or ask the user. Every decision stores per-signal scores in `application_match_candidates` (explainability). Ambiguous cases never auto-guess — they go to the review queue.

## Version

`match-v1` (`MATCHER_VERSION` in `packages/core/src/matching/version.ts`). Bump on behavior change (R-8).

## Signals (AGENTS.md §15.1)

| Signal | Weight | Notes |
|--------|--------|-------|
| sameThread | 0.95 | Same Gmail thread as an already-attached email |
| requisitionOrUrl | 0.9 | Req ID / job URL path token |
| portalUrl | 0.8 | Unique portal URL |
| recruiterSender | 0.5 | Same recruiter address on prior events |
| roleTitleSimilarity | 0.4 | Token overlap on normalized titles |
| assessmentContinuity | 0.4 | Same OA provider |
| locationMatch | 0.2 | Location string overlap |
| recencyPrior | 0.2 | Decays over 45 days |
| stateCompatibility | 0.3 | Event type fits current stage |
| terminalPenalty | −0.4 | Terminal state >30d stale |

Raw weighted sum is clamped to `[0, 1]`.

## Thresholds (§15.2)

| Outcome | Condition |
|---------|-----------|
| `auto_attached` | score ≥ 0.75 **and** margin ≥ 0.2 over runner-up |
| `review` (ambiguous / unmatched) | 0.45–0.75, or margin < 0.2, or no candidates for non-confirmation |
| `new_application` | score < 0.45 (or no candidates) **and** event is `application_confirmation` |
| `rejected` | non-job / newsletter / unknown (skipped) |

## Company resolution (§14, minimal for M8)

Exact alias / seed / domain hit → attach to company. Fuzzy Jaro-Winkler ≥ 0.85 → create company **and** `entity_merge_suggestion` review item (no silent merges). Unknown → create new company + auto alias.

## Pipeline

```
email.sync → normalize → classify → application.match
                                      ├─ match_candidates (audit)
                                      ├─ application_events (auto / new)
                                      └─ review_queue_items (ambiguous)
```

New attachments at a company trigger `match.reevaluate` for open `ambiguous_match` items at that company.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/match/version` | `match-v1` |
| POST | `/api/v1/match/:messageId` | Run matcher; persist decision |
| GET | `/api/v1/match/:messageId/candidates` | Audit rows |
| POST | `/api/v1/match/reevaluate/:companyId` | Re-score open ambiguities |
| GET | `/api/v1/review?kind=` | Open review queue |

## Tests

```bash
pnpm --filter @apptrack/core test
pnpm --filter @apptrack/server test
```

Core covers threshold/margin, multi-role + thread continuity, reapplication via req ID, assessment continuity, and a fast-check determinism property (candidate order independence).
