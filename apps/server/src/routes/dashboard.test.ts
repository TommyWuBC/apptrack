import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("dashboard routes", () => {
  it("GET /api/v1/stats returns 503 without db", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/api/v1/stats" });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("GET /api/v1/companies returns 503 without db", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({ method: "GET", url: "/api/v1/companies" });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("GET /api/v1/emails/:id/evidence returns 503 without db", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/emails/00000000-0000-7000-8000-000000000001/evidence",
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
