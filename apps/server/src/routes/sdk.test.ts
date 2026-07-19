import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { resolveSdkJsPath } from "./sdk.js";

describe("GET /sdk.js", () => {
  it("resolves built sdk when present", () => {
    const path = resolveSdkJsPath();
    // Build runs before server tests via turbo ^build / local prep
    if (!path) {
      expect(path).toBeNull();
      return;
    }
    expect(path.endsWith("sdk.js")).toBe(true);
  });

  it("serves javascript when artifact exists", async () => {
    const path = resolveSdkJsPath();
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/sdk.js" });
    await app.close();
    if (!path) {
      expect(res.statusCode).toBe(503);
      return;
    }
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/javascript/);
    expect(res.body.length).toBeGreaterThan(100);
    expect(res.body).toContain("apptrack");
  });
});
