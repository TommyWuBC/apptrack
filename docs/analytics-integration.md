# Analytics ingestion & browser SDK

Last verified against code: 2026-07-19 (M15).

## Privacy (INV-8)

- Raw visitor IPs are used **in memory** only to compute `visitor_hash` and optional geo, then discarded.
- No `ip` column exists on `analytics_sites`, `analytics_sessions`, or `analytics_events` (schema tests enforce this).
- `visitor_hash = sha256(daily_salt || site_key || ip || ua_family)` — salt rotates daily (UTC).
- Site modes: `full` | `no_geo` | `off`.

## Browser SDK (`GET /sdk.js`)

Embed on any first-party site (see `examples/website-astro/`):

```html
<script
  defer
  src="https://YOUR_TRACKER/sdk.js"
  data-site-key="pk_..."
  data-mode="full"
></script>
```

| Attribute       | Purpose                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| `data-site-key` | Required public site key                                                             |
| `data-mode`     | Optional client override; `off` disables capture                                     |
| `data-endpoint` | Optional full ingest URL (default: same host as script → `/api/v1/analytics/events`) |

Behavior:

- Zero runtime dependencies; **gzip size gated &lt; 2 KB** in CI (`packages/analytics-sdk` build)
- Cookie-free; no `localStorage`
- Auto `page_view` on load; hooks `history.pushState` / `replaceState` / `popstate` for SPAs
- Reads `?src=` into `srcToken` on subsequent events
- Exposes `window.apptrack.track(type, props)` and `.flush()`
- Transport: `navigator.sendBeacon`, falling back to `fetch({ keepalive: true })`
- Batches ≤10 events (server hard cap 25) and soft-guards ~8 KB payloads

Build: `pnpm --filter @apptrack/analytics-sdk build` → `dist/sdk.js`.

## Ingest

`POST /api/v1/analytics/events` (public)

- Body: `{ siteKey, events: [...] }` — max **25** events, **8 KB** payload
- Zod allowlists for `eventType` and `props` keys
- CORS restricted to the site's `origin_allowlist` (empty allowlist = any origin in dev)
- In-memory rate limits per site key and per hashed source IP
- Handler inserts events (with visitor/geo context) and returns `202` — sessionization is deferred

## Sessionization

`POST /api/v1/analytics/aggregate` (or worker poll every 5m)

Groups unsessionized events by `(siteId, visitorHash)` into **30-minute** idle windows, writes `analytics_sessions`, links events.

## Retention

`POST /api/v1/analytics/retention` — deletes events/sessions older than ~13 months (D-5, configurable).

## Sites settings

| Method       | Path                                 |
| ------------ | ------------------------------------ |
| GET/POST     | `/api/v1/analytics/sites`            |
| PATCH/DELETE | `/api/v1/analytics/sites/:id`        |
| GET          | `/api/v1/analytics/sessions?siteId=` |
| GET          | `/api/v1/analytics/summary?siteId=`  |

SPA: Settings → Analytics sites.

## Example site

`examples/website-astro/` — minimal Astro portfolio + Playwright harness (`pnpm e2e:sdk`).

## Load script

```bash
# Against a running server with a real site key:
pnpm exec tsx scripts/analytics-load.ts --url http://localhost:3000 --site-key pk_...
```
