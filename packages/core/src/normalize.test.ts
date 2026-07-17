import { describe, expect, it } from "vitest";
import { coreHealth, normalizeCompanyName } from "./normalize.js";

describe("@apptrack/core normalize", () => {
  it("reports healthy", () => {
    expect(coreHealth()).toEqual({ ok: true, package: "core" });
  });

  it("normalizes company names", () => {
    expect(normalizeCompanyName("Initech, Inc.")).toBe("initech");
    expect(normalizeCompanyName("Hooli LLC")).toBe("hooli");
  });
});
