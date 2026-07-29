# ADR-008: Rules-based correlation v1

**Status:** accepted  
**Date:** 2026-07-17  
**Reversibility:** reversible

## Context

Owners may want to see whether anonymous portfolio visits plausibly relate to applications
without identifying visitors or recruiters. ML correlation is deferred (D-6).

## Decision

Transparent rules algorithm (`corr-v1`): weighted features (timing, geo, referrer, résumé
events) with ambiguity divisor across active applications in the same metro. Probabilistic
scores are **hard-capped at medium**; `high` requires deterministic unique-link (`src_token`)
attribution. Feature disabled by default (`CORRELATION_ENABLED=false`). UI copy is
constrained and banned phrases are tested.

## Consequences

- `correlation_predictions` and `correlation_features` store scores and explanations.
- User feedback (`confirmed`/`rejected`) seeds a future local-only model path.
- No cross-user label pooling in self-hosted deployments.

## Alternatives considered

- **ML model v1:** needs labeled data and obscures explainability.
- **No correlation:** loses differentiated portfolio integration story.
