# ADR-006: Deterministic-first layered classification

**Status:** accepted  
**Date:** 2026-07-17  
**Reversibility:** reversible per layer

## Context

Job mail is largely ATS-templated. Sending every message to an LLM adds cost, privacy
egress, and non-reproducible results. The product must run fully without external AI
(NFR-6).

## Decision

Layered pipeline L0–L3: prefilter → ATS templates (L1) → keyword rules (L2) → optional LLM
(L3). `CLASSIFIER_MODE` defaults to `deterministic`. LLM runs only when mode permits and
L1/L2 confidence is low or extraction incomplete. Arbitration favors deterministic on
conflict; disagreement routes to review.

## Consequences

- Golden-set regression tests gate classifier changes in CI.
- `classifier_versions` registry records rules, prompt, and model tuple for FR-10.
- Users who need maximum coverage opt into `api`/`hybrid` with disclosed egress.

## Alternatives considered

- **LLM-first:** better long-tail recall, violates privacy default and reproducibility.
- **Rules only forever:** acceptable v1 default; L3 optional for remainder.
