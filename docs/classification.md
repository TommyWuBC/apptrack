# Deterministic classification

Last verified against code: 2026-07-17 (M7).

## Mode

`CLASSIFIER_MODE=deterministic` (default). No LLM. Low-confidence / `unknown` → `needsReview`.

## Layers

| Layer | Role |
|-------|------|
| Guard | Prompt-injection canaries → `unknown` (do not follow instructions) |
| L1 | ATS platform from sender/domain; subject template hints; calendar → interview_scheduled |
| L2 | Keyword rule families (`rules/families.ts`) with anti-patterns |

Version: `clf-2026.07.0` / rules `rules-2026.07.0`.

## API

| Method | Path |
|--------|------|
| GET | `/api/v1/classify/version` |
| POST | `/api/v1/classify/:messageId` |

Sync auto-classifies after normalize on new inserts.

## Eval

```bash
pnpm eval
```

Writes `fixtures/golden/baseline.json`. Acceptance: F1 ≥ 0.85 on confirmation / rejection / OA / interview core types. CI fails if any event-type F1 drops >2 points vs committed baseline.
