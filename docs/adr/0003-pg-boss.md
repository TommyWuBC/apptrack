# ADR-003: pg-boss (Postgres queue)

**Status:** accepted  
**Date:** 2026-07-17  
**Reversibility:** reversible (behind jobs interface)

## Decision

Use pg-boss instead of Redis+BullMQ. Removes a stateful service from self-hosting; enqueue-in-same-transaction as data writes.
