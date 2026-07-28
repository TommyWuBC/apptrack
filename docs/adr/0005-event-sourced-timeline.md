# ADR-005: Event-sourced application timeline

**Status:** accepted  
**Date:** 2026-07-17  
**Reversibility:** hard

## Context

Application status changes when emails arrive out of order, users correct fields, or
reprocessing updates classifications. A mutable status column destroys audit history and
makes "how was this inferred?" impossible to answer.

## Decision

`application_events` is the append-only source of truth. `applications.current_state` is a
projection computed by a pure, versioned reducer replaying events sorted by
`(occurred_at, ingested_at, id)` (INV-9).

## Consequences

- Late-arriving mail and backfill commute without special cases.
- Reprocessing diffs events instead of overwriting rows.
- `application.recompute` job replays history idempotently.
- Higher storage than a single status column; acceptable at NFR-1 envelope.

## Alternatives considered

- **Mutable status column:** simpler reads, loses history and conflicts on reprocess.
- **Full CQRS/event store framework:** overkill for single-user scale.
