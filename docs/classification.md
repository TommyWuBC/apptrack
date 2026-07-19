# Classification (deterministic + optional LLM)

Last verified against code: 2026-07-19 (M13).

## Modes (`CLASSIFIER_MODE` / settings)

| Mode | Behavior |
|------|----------|
| `deterministic` (default) | L0–L2 only. Fully local (NFR-6). |
| `hybrid` | Deterministic first; L3 only when confidence &lt; 0.75 or extraction incomplete |
| `api` | Same L3 gate; Anthropic or OpenAI |
| `local` | Same L3 gate; Ollama HTTP |

Mode is stored on each `classification_results` row. Settings UI shows an **egress disclosure** stating exactly what is sent where.

## Layers

| Layer | Role |
|-------|------|
| Guard | Prompt-injection canaries → `unknown` (never call LLM) |
| L1 | ATS platform / subject templates / calendar |
| L2 | Keyword rule families |
| L3 | Optional LLM extraction (`extract.v1`); schema-validated `LlmExtractionV1` |

Version: `clf-2026.07.1` / rules `rules-2026.07.0` / prompt `extract.v1`.

## Prompt-injection (T6)

Emails are wrapped in `<untrusted_email>`. The model has no tools. Output is zod-validated against an allowlist; invalid → treated as no-answer + `needsReview`. Canary fixtures under `fixtures/emails/_edge/unknown/` must stay `unknown`.

## API

| Method | Path |
|--------|------|
| GET | `/api/v1/classify/version` |
| POST | `/api/v1/classify/:messageId` |
| GET/PATCH | `/api/v1/settings/classifier` |

## Eval

```bash
pnpm eval
```

Deterministic path only (no LLM). CI fails if event-type F1 drops &gt;2 points vs `fixtures/golden/baseline.json`.
