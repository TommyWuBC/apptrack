import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("sync routes without database", () => {
  it("POST /api/v1/sync/run returns 503", async () => {
    const app = await buildApp({ logger: false, databaseUrl: "" });
    const res = await app.inject({ method: "POST", url: "/api/v1/sync/run" });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("GET /api/v1/sync/status returns 503", async () => {
    const app = await buildApp({ logger: false, databaseUrl: "" });
    const res = await app.inject({ method: "GET", url: "/api/v1/sync/status" });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
