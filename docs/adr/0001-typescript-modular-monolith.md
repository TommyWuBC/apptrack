# ADR-001: TypeScript modular monolith

**Status:** accepted  
**Date:** 2026-07-17  
**Reversibility:** hard

## Context

Need one language for shared schemas (ExtractionV1, ClassificationResultV1, API DTOs, frontend types) end-to-end. Python wins on ML, but v1 classification is deterministic-first.

## Decision

TypeScript modular monolith: Fastify server + pg-boss worker + React SPA, shared zod contracts in `packages/shared`.

## Consequences

Agents and humans share one type system. Extension/pivot cost is schema stability, not engine language.
