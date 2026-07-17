import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EventType } from "@apptrack/shared";
import { classifyEmail } from "./classify.js";
import { normalizeEmail } from "../normalize/index.js";

const fixturesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures/emails",
);

async function classifyFixture(emlPath: string) {
  const raw = readFileSync(emlPath);
  const n = await normalizeEmail({ rawMime: raw });
  // Recover From from raw headers lightly
  const text = raw.toString("utf8");
  const from = text.match(/^From:\s*(.+)$/im)?.[1] ?? "";
  const fromEmail = from.match(/<([^>]+)>/)?.[1] ?? from;
  const subject =
    n.subject ??
    text.match(/^Subject:\s*(.+)$/im)?.[1]?.replace(/^=\?UTF-8\?B\?.*/, "") ??
    "";
  return classifyEmail({
    subject: n.subject ?? subject,
    textPlain: n.textPlain,
    textFull: n.textFull,
    fromAddress: fromEmail,
    links: n.links,
    calendarEvent: n.calendarEvent,
  });
}

describe("classifyEmail", () => {
  it("classifies greenhouse confirmation", async () => {
    const r = await classifyFixture(
      join(
        fixturesRoot,
        "greenhouse/application_confirmation/greenhouse-application_confirmation-v0.eml",
      ),
    );
    expect(r.eventType).toBe(EventType.application_confirmation);
    expect(r.confidence).toBeGreaterThanOrEqual(0.75);
    expect(r.extraction.atsPlatform).toBe("greenhouse");
  });

  it("classifies rejection", async () => {
    const r = await classifyFixture(
      join(fixturesRoot, "greenhouse/rejection/greenhouse-rejection-v5.eml"),
    );
    expect(r.eventType).toBe(EventType.rejection);
  });

  it("does not follow prompt-injection canary", async () => {
    const r = await classifyFixture(
      join(
        fixturesRoot,
        "_edge/unknown/prompt-injection-canary-offer.eml",
      ),
    );
    expect(r.eventType).toBe(EventType.unknown);
    expect(r.needsReview).toBe(true);
  });

  it("hits >=0.85 recall on core event types in greenhouse set", async () => {
    const core = [
      "application_confirmation",
      "oa_invitation",
      "interview_invitation",
      "interview_scheduled",
      "rejection",
      "offer",
    ];
    let ok = 0;
    let total = 0;
    for (const et of core) {
      const dir = join(fixturesRoot, "greenhouse", et);
      try {
        for (const name of readdirSync(dir)) {
          if (!name.endsWith(".eml")) continue;
          total += 1;
          const r = await classifyFixture(join(dir, name));
          if (r.eventType === et) ok += 1;
        }
      } catch {
        /* missing dir */
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(ok / total).toBeGreaterThanOrEqual(0.85);
  });
});
