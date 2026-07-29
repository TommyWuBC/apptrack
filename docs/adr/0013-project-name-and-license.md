# ADR-013: Project name and license (D-9)

**Status:** accepted  
**Date:** 2026-07-29  
**Reversibility:** medium (rename is costly; license change needs contributor agreement)

## Context

Deferred decision D-9 tracked renaming the working title `apptrack` before open-source
release and choosing between MIT and AGPL for SaaS-protection.

## Decision

1. **Name:** Keep **apptrack** for v1.0.0 open-source release. The name is descriptive,
   already used across packages (`@apptrack/*`), Docker images, and documentation.
2. **License:** Release under the **MIT License**, Copyright (c) 2026 apptrack contributors.

## Consequences

- `LICENSE` file added at repository root.
- Downstream forks may use apptrack in proprietary deployments without copyleft obligation.
- If a hosted multi-tenant SaaS is offered later, AGPL or a commercial license may be
  reconsidered via a new ADR — not retroactive without contributor consent.

## Alternatives considered

- **Rename before release:** delays M18–M20 packaging; low user-facing benefit at v1.
- **AGPL-3.0:** stronger SaaS protection but friction for contributors and self-hosters
  embedding the dashboard; rejected for initial OSS release per owner preference.
