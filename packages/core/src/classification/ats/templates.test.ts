import { describe, expect, it } from "vitest";
import { EventType } from "@apptrack/shared";
import { detectAtsTemplate } from "./templates.js";

describe("ATS template detectors", () => {
  it.each([
    ["greenhouse", "notifications@greenhouse.io"],
    ["lever", "no-reply@hire.lever.co"],
    ["workday", "recruiting@myworkday.com"],
    ["ashby", "jobs@ashbyhq.com"],
    ["icims", "careers@icims.com"],
    ["smartrecruiters", "jobs@smartrecruiters.com"],
    ["taleo", "recruiting@taleo.net"],
    ["jobvite", "notifications@jobvite.com"],
  ])("detects %s application confirmation templates", (platform, sender) => {
    const match = detectAtsTemplate({
      fromAddress: sender,
      subject: "Application confirmation",
      text: "Thank you for applying. Your application has been received.",
    });
    expect(match).toMatchObject({
      platform,
      eventType: EventType.application_confirmation,
    });
    expect(match!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("prefers rejection markers over generic application language", () => {
    expect(
      detectAtsTemplate({
        fromAddress: "notifications@greenhouse.io",
        text: "Thank you for applying. Unfortunately, we are not moving forward.",
      })?.eventType,
    ).toBe(EventType.rejection);
  });
});
