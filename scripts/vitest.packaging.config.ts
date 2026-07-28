import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/v1-packaging.test.ts"],
  },
});
