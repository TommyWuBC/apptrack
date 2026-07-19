import { describe, expect, it } from "vitest";
import { REDUCER_VERSION } from "@apptrack/core";
import { buildApp } from "../app.js";

describe("applications routes", () => {
  it("GET /api/v1/applications/reducer-version", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/applications/reducer-version",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ reducerVersion: REDUCER_VERSION });
    await app.close();
  });

  it("GET /api/v1/applications/:id/timeline returns 503 without db", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/applications/00000000-0000-7000-8000-000000000001/timeline",
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("POST /api/v1/applications/:id/recompute returns 503 without db", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/applications/00000000-0000-7000-8000-000000000001/recompute",
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
