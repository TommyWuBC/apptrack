import { describe, expect, it } from "vitest";
import { formatRateStat, rateStat } from "./stats-service.js";

describe("small-sample rate guard (§19)", () => {
  it("n < 10 → rate null and n/N format", () => {
    const s = rateStat(3, 8, "Offer rate");
    expect(s.smallSample).toBe(true);
    expect(s.rate).toBeNull();
    expect(formatRateStat(s)).toBe("3/8");
  });

  it("n ≥ 10 → percentage", () => {
    const s = rateStat(4, 20, "Offer rate");
    expect(s.smallSample).toBe(false);
    expect(s.rate).toBeCloseTo(0.2);
    expect(formatRateStat(s)).toBe("20%");
  });
});
