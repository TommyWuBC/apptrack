import { describe, expect, it } from "vitest";
import { MATCHER_VERSION } from "@apptrack/core";
import { buildApp } from "../app.js";

describe("match routes", () => {
  it("GET /api/v1/match/version", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/match/version",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ matcherVersion: MATCHER_VERSION });
    await app.close();
  });

  it("POST /api/v1/match/:id returns 503 without db", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/match/00000000-0000-7000-8000-000000000001",
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("GET /api/v1/review returns 503 without db", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/api/v1/review" });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
