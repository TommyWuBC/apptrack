# ADR-012: Tracker-served tokenized resume links

**Status:** accepted  
**Date:** 2026-07-17  
**Reversibility:** reversible

## Context

Probabilistic correlation from geo and timing is intentionally weak. Per-application unique
links provide deterministic attribution when the user opts in, but can feel surveillance-like
to recipients who notice the token.

## Decision

Mint unguessable per-application tokens (`unique_link_token`) for portfolio `?src=` URLs and
optional tracker-served resume downloads at `GET /r/:token/resume.pdf`. Deterministic
`resume_download` events with `src_token` set correlation band to `high`. Feature is
opt-in per application; disclosure page documents the tradeoff.

## Consequences

- Strongest correlation signal without identifying anonymous visitors by name.
- Tokens revocable; 404 when revoked.
- UI and copy must not claim recruiter identity — only link usage.

## Alternatives considered

- **Probabilistic only:** no high-confidence path; weaker product story.
- **Mandatory unique links:** rejected as too aggressive for default UX.
