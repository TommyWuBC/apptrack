import { defineConfig, devices } from "@playwright/test";

/**
 * SDK contract e2e against the local harness (serves sdk.js + demo HTML).
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
  webServer: {
    command: "node e2e/harness.mjs",
    url: "http://127.0.0.1:4321/sdk.js",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
