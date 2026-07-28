# ADR-007: First-party SDK and server ingestion for analytics

**Status:** accepted  
**Date:** 2026-07-17  
**Reversibility:** medium

## Context

A future portfolio site needs privacy-conscious visitor analytics correlated (probabilistically)
with job applications. Third-party trackers and reverse-proxy log parsing conflict with
self-hosting and cookie-free goals.

## Decision

Ship a lightweight first-party JavaScript SDK (`packages/analytics-sdk`, served at
`GET /sdk.js`) and a public ingestion endpoint `POST /api/v1/analytics/events`. Visitor
identity uses a daily-rotating server-side salted hash; raw IPs are discarded after optional
in-memory geolocation (INV-8). No cookies in default mode.

## Consequences

- Contract-first integration documented in `docs/analytics-integration.md`.
- Example Astro site proves end-to-end flow in CI.
- Sessionization runs in `analytics.aggregate` job, not inline on ingest (NFR-2).

## Alternatives considered

- **Third-party analytics adapter:** defeats privacy positioning.
- **Log parsing only:** misses SPA events and custom events.
