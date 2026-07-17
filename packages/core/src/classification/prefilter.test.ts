import { describe, expect, it } from "vitest";
import { prefilterEmail } from "./prefilter.js";

describe("L0 prefilter", () => {
  it("fetches ATS senders", () => {
    const d = prefilterEmail({
      fromAddress: "no-reply@greenhouse.io",
      subject: "Thanks for applying",
    });
    expect(d.action).toBe("fetch");
    expect(d.reason).toMatch(/ATS/);
  });

  it("skips newsletter List-Id bulk", () => {
    const d = prefilterEmail({
      fromAddress: "news@marketing.example.com",
      listId: "<weekly.marketing.example.com>",
      listUnsubscribe: "<mailto:unsub@example.com>",
    });
    expect(d.action).toBe("skip");
    if (d.action === "skip") {
      expect(d.eventHint).toBe("newsletter_ignore");
    }
  });

  it("defaults to fetch for unknown personal mail", () => {
    const d = prefilterEmail({
      fromAddress: "recruiter@initech.example",
      subject: "Quick chat?",
    });
    expect(d.action).toBe("fetch");
  });
});
