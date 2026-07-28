# ADR-010: Server-side cookie sessions with argon2id

**Status:** accepted  
**Date:** 2026-07-17  
**Reversibility:** reversible

## Context

v1 targets a single self-hosted owner. Authentication must resist session hijacking and
credential theft without an external identity provider.

## Decision

Server-side sessions stored in Postgres (SHA-256 hashed token at rest). httpOnly + Secure +
SameSite=Lax session cookie. Passwords hashed with argon2id. CSRF via double-submit
(`X-CSRF-Token` + cookie) on state-changing routes. Session rotation on login; absolute and
idle expiry.

## Consequences

- No JWT in localStorage (XSS-resistant session binding).
- Worker-to-server internal jobs use separate `INTERNAL_JOB_SECRET` header.
- Multi-user auth can extend the same table layout (`user_id` already on domain rows).

## Alternatives considered

- **JWT-only SPA auth:** harder to revoke server-side; tokens in JS increase XSS blast radius.
- **External auth (Clerk, Auth0):** adds dependency and phone-home for self-hosters.
