# ADR-011: Store extracted text and sanitized HTML; raw MIME opt-in

**Status:** accepted  
**Date:** 2026-07-17  
**Reversibility:** reversible

## Context

Classification and timeline evidence need email content, but storing full raw MIME increases
sensitive data volume. Reprocessing should not require re-downloading from Gmail (FR-10).

## Decision

Default: persist normalized `text_plain`, `text_full`, and `sanitized_html` indefinitely as
the evidence trail. Raw MIME stored only when `STORE_RAW_MIME=true`, encrypted at rest,
retained `RAW_MIME_RETENTION_DAYS` (default 30) then nulled by retention job. Optional
`EMAIL_BODY_ENCRYPTION=on` for normalized bodies.

## Consequences

- XSS mitigated via strict sanitizer on ingest (T4).
- Backups contain plaintext email text unless body encryption enabled — documented in setup.
- Gmail provider deletions tombstone locally but keep normalized copy for user evidence.

## Alternatives considered

- **Raw MIME always:** higher storage and leak surface.
- **Headers only:** insufficient for classification and user review.
