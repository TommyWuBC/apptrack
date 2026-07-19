# Example portfolio (Astro) — apptrack analytics SDK

Minimal static portfolio that embeds the apptrack browser SDK (`/sdk.js`).

All content is **synthetic** (fictional name). Do not point this at a production mailbox.

## Quick start

1. Run apptrack server (with a site key created in Settings → Analytics).
2. From this directory:

```bash
pnpm install
PUBLIC_SITE_KEY=pk_your_key PUBLIC_TRACKER_ORIGIN=http://127.0.0.1:3000 pnpm dev
```

Open http://127.0.0.1:4321 — page views and `window.apptrack.track(...)` calls batch to the ingest API.

## Embed snippet

```html
<script
  defer
  src="https://YOUR_TRACKER/sdk.js"
  data-site-key="pk_..."
  data-mode="full"
></script>
```

Optional: `data-endpoint` overrides the inferred ingest URL; `data-mode="off"` disables capture.

## E2E

```bash
pnpm --filter @apptrack/analytics-sdk build
pnpm install
pnpm e2e
```

Playwright boots a local static server that serves the built example pages + `sdk.js`, and asserts page views, SPA navigation, `?src=` tokens, and sendBeacon→fetch fallback.
