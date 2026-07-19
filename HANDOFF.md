# HANDOFF

## Current state
**M15 complete.** Analytics browser SDK (`packages/analytics-sdk` → `GET /sdk.js`, gzip &lt;2KB), example Astro portfolio, Playwright contract e2e (pageview / SPA / src token / sendBeacon→fetch).

## Last action taken
Implemented M15: SDK build+size gate, server `/sdk.js`, `examples/website-astro`, docs, CI `e2e:sdk`.

## Next action
**M16 — Correlation scoring** (needs M9 + M15): `corr-v1`, unique links, tracked resume, banned-phrase tests, feature flag.

## Open blockers
- Docker Desktop (live DB for migrations + full ingest e2e against real Postgres).

## Gotchas
- SDK gzip gate is in `packages/analytics-sdk` build (`scripts/build-sdk.ts`); CI also runs `pnpm e2e:sdk`.
- Example e2e uses `e2e/harness.mjs` (does not require `astro build`); Astro site is for human demos.
- Empty origin allowlist = any origin (dev); lock allowlist in production.
- Playwright web e2e still needs `@apptrack/web` build before `pnpm e2e`.

## Do not
- Persist raw IPs (INV-8).
- Fetch URLs from email/analytics content (INV-6).
- Commit secrets / real emails / `.env`.
- Silent company merges; overwrite locked fields (INV-7).
