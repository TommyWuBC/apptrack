import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("ghost routes", () => {
  it("GET /api/v1/ghost/version returns defaults", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/ghost/version",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      algorithmVersion: string;
      defaults: { staleAfterDays: number; ghostAfterDays: number };
    };
    expect(body.algorithmVersion).toBe("ghost-v1");
    expect(body.defaults.staleAfterDays).toBe(45);
    expect(body.defaults.ghostAfterDays).toBe(90);
    await app.close();
  });

  it("POST /api/v1/ghost/evaluate without DB → 503", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ghost/evaluate",
      payload: {},
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("GET /api/v1/settings/ghost without DB → 503", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/settings/ghost",
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});
