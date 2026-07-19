import { describe, expect, it } from "vitest";
import { formatRate } from "../components/RateStatDisplay.js";
import type { RateStat } from "../api/client.js";

describe("RateStatDisplay formatRate (small-sample guard)", () => {
  it("formats small samples as n/N", () => {
    const stat: RateStat = {
      smallSample: true,
      numerator: 2,
      denominator: 7,
      rate: null,
      label: "Offer rate",
    };
    expect(formatRate(stat)).toBe("2/7");
    expect(formatRate(stat).endsWith("%")).toBe(false);
  });

  it("formats large samples as percent", () => {
    const stat: RateStat = {
      smallSample: false,
      numerator: 5,
      denominator: 20,
      rate: 0.25,
      label: "Offer rate",
    };
    expect(formatRate(stat)).toBe("25%");
  });
});
