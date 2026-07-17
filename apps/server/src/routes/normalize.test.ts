import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("normalize routes", () => {
  it("GET /api/v1/normalize/version", async () => {
    const app = await buildApp({ logger: false, databaseUrl: "" });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/normalize/version",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().normalizerVersion).toMatch(/^norm-/);
    await app.close();
  });

  it("POST /api/v1/normalize/:id returns 503 without db", async () => {
    const app = await buildApp({ logger: false, databaseUrl: "" });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/normalize/00000000-0000-0000-0000-000000000001",
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
