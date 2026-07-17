# ADR-004: Polling Gmail sync (OAuth in M4)

**Status:** accepted  
**Date:** 2026-07-17  
**Reversibility:** reversible

## Decision

v1 uses OAuth + polling (`users.history.list`) rather than Gmail push/Pub/Sub. M4 delivers the OAuth credential lifecycle; M5 delivers incremental sync. Push can later enqueue the same sync job.
