import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("server hello-world", () => {
  it("GET /api/v1/hello returns apptrack", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/api/v1/hello" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      message: "apptrack",
      milestone: "M1",
    });
    await app.close();
  });

  it("GET /healthz is ok", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("GET /readyz is 503 without DATABASE_URL", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: "not_ready", db: false });
    await app.close();
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  });
});
