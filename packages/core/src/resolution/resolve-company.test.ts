import { describe, expect, it } from "vitest";
import { jaroWinkler } from "./jaro-winkler.js";
import { resolveCompany } from "./resolve-company.js";
import {
  inferRoleLevel,
  normalizeRoleTitle,
  roleTitleSimilarity,
} from "./normalize-role.js";

describe("jaroWinkler", () => {
  it("returns 1 for identical strings", () => {
    expect(jaroWinkler("initech", "initech")).toBe(1);
  });

  it("is high for near-matches", () => {
    expect(jaroWinkler("initech", "initechh")).toBeGreaterThan(0.9);
  });

  it("is low for unrelated names", () => {
    expect(jaroWinkler("initech", "hooli")).toBeLessThan(0.5);
  });
});

describe("resolveCompany", () => {
  it("exact seed alias hit", () => {
    const r = resolveCompany({
      companyName: "Initech, Inc.",
      aliases: [],
      includeSeed: true,
    });
    expect(r.kind).toBe("exact");
    if (r.kind === "exact") {
      expect(r.canonicalName).toBe("Initech");
      expect(r.source).toBe("seed");
    }
  });

  it("exact DB alias preferred", () => {
    const r = resolveCompany({
      companyName: "Acme",
      aliases: [
        {
          companyId: "c1",
          canonicalName: "Acme Corp",
          alias: "acme",
          aliasType: "name",
        },
      ],
      includeSeed: false,
    });
    expect(r.kind).toBe("exact");
    if (r.kind === "exact") {
      expect(r.companyId).toBe("c1");
      expect(r.source).toBe("db");
    }
  });

  it("fuzzy suggest above threshold (no silent merge)", () => {
    const r = resolveCompany({
      companyName: "Initechh",
      aliases: [
        {
          companyId: "c-init",
          canonicalName: "Initech",
          alias: "initech",
          aliasType: "name",
        },
      ],
      includeSeed: false,
    });
    expect(r.kind).toBe("fuzzy_suggest");
    if (r.kind === "fuzzy_suggest") {
      expect(r.companyId).toBe("c-init");
      expect(r.similarity).toBeGreaterThanOrEqual(0.85);
    }
  });

  it("create_new when unknown", () => {
    const r = resolveCompany({
      companyName: "Zorp Industries",
      aliases: [],
      includeSeed: false,
    });
    expect(r.kind).toBe("create_new");
    if (r.kind === "create_new") {
      expect(r.canonicalName).toBe("Zorp Industries");
    }
  });

  it("domain exact hit", () => {
    const r = resolveCompany({
      domain: "hooli.com",
      aliases: [],
      includeSeed: true,
    });
    expect(r.kind).toBe("exact");
    if (r.kind === "exact") expect(r.canonicalName).toBe("Hooli");
  });
});

describe("role normalization", () => {
  it("strips locations and req ids", () => {
    expect(normalizeRoleTitle("SWE Intern (Remote) — Req R-99")).toContain(
      "swe intern",
    );
    expect(normalizeRoleTitle("SWE Intern (Remote)")).not.toMatch(/remote/);
  });

  it("infers level", () => {
    expect(inferRoleLevel("software engineering intern")).toBe("intern");
    expect(inferRoleLevel("new grad swe")).toBe("new_grad");
  });

  it("title similarity", () => {
    expect(
      roleTitleSimilarity("Software Engineering Intern", "SWE Intern"),
    ).toBeGreaterThan(0);
    expect(
      roleTitleSimilarity("Software Engineer", "Marketing Manager"),
    ).toBe(0);
  });
});
