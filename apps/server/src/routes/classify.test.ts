import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("classify routes", () => {
  it("GET /api/v1/classify/version", async () => {
    const app = await buildApp({ logger: false, databaseUrl: "" });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/classify/version",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().classifierVersion).toMatch(/^clf-/);
    await app.close();
  });
});
