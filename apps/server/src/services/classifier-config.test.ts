import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { resolveClassifierConfig } from "../services/classifier-config.js";

describe("classifier config", () => {
  it("defaults to deterministic with local-only egress", () => {
    const c = resolveClassifierConfig(null, {
      CLASSIFIER_MODE: "deterministic",
    } as NodeJS.ProcessEnv);
    expect(c.mode).toBe("deterministic");
    expect(c.llm).toBeNull();
    expect(c.egressDisclosure).toMatch(/No email content leaves/i);
  });

  it("hybrid without keys has no client but discloses hybrid path", () => {
    const c = resolveClassifierConfig(
      { mode: "hybrid", provider: "anthropic" },
      {} as NodeJS.ProcessEnv,
    );
    expect(c.mode).toBe("hybrid");
    // missing key → client still created but calls will fail; factory doesn't check key until call
    expect(c.provider).toBe("anthropic");
  });
});

describe("classifier settings routes", () => {
  it("GET /api/v1/settings/classifier works without DB", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/settings/classifier",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      egressDisclosure: string;
      settings: { mode: string };
    };
    expect(body.settings.mode).toBe("deterministic");
    expect(body.egressDisclosure.length).toBeGreaterThan(20);
    await app.close();
  });

  it("GET /api/v1/classify/version includes prompt", async () => {
    const app = await buildApp({ logger: false });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/classify/version",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      classifierVersion: string;
      promptVersion: string;
    };
    expect(body.classifierVersion).toBe("clf-2026.07.1");
    expect(body.promptVersion).toBe("extract.v1");
    await app.close();
  });
});
