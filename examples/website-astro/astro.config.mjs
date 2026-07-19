import { defineConfig } from "astro/config";

/**
 * Minimal portfolio example wired to apptrack analytics SDK.
 * Ingest endpoint defaults to the same-origin tracker when served behind
 * the apptrack server; for local demo, set PUBLIC_TRACKER_ORIGIN.
 */
export default defineConfig({
  output: "static",
  server: { host: "127.0.0.1", port: 4321 },
  vite: {
    server: {
      proxy: {
        "/sdk.js": {
          target:
            process.env.TRACKER_PROXY_ORIGIN ??
            process.env.PUBLIC_TRACKER_ORIGIN ??
            "http://127.0.0.1:3000",
          changeOrigin: true,
        },
        "/api": {
          target:
            process.env.TRACKER_PROXY_ORIGIN ??
            process.env.PUBLIC_TRACKER_ORIGIN ??
            "http://127.0.0.1:3000",
          changeOrigin: true,
        },
      },
    },
  },
});
