import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/fixtures-validate.test.ts"],
    testTimeout: 120_000,
  },
});
