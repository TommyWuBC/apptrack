import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("corrections routes", () => {
  it("PATCH /api/v1/applications/:id returns 503 without db", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/applications/00000000-0000-7000-8000-000000000001",
      payload: { fields: [{ field: "currentState", userValue: "offer" }] },
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("POST /api/v1/review/:id/resolve returns 503 without db", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/review/00000000-0000-7000-8000-000000000001/resolve",
      payload: { kind: "ambiguous_match", action: "dismiss" },
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("POST /api/v1/companies/merge returns 503 without db", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/companies/merge",
      payload: {
        survivorCompanyId: "a",
        sourceCompanyId: "b",
      },
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
