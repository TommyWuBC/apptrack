import { defineConfig, devices } from "@playwright/test";

/**
 * SDK contract e2e against the real Astro example and a tracker harness.
 * Requires: pnpm --filter @apptrack/analytics-sdk build
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "E2E_PORT=3001 node e2e/harness.mjs",
      url: "http://127.0.0.1:3001/sdk.js",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command:
        "TRACKER_PROXY_ORIGIN=http://127.0.0.1:3001 PUBLIC_SITE_KEY=pk_e2e_demo_site_key pnpm dev",
      url: "http://127.0.0.1:4321",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
