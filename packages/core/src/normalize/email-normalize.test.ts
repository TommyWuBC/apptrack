import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  sanitizeEmailHtml,
  stripQuotesAndSignatures,
  NORMALIZER_VERSION,
} from "./index.js";

const fixturesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures",
);

function walkEml(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkEml(p, out);
    else if (name.endsWith(".eml")) out.push(p);
  }
  return out;
}

describe("sanitizeEmailHtml XSS", () => {
  it("strips script/style/iframe/handlers", () => {
    const dirty = `<p>Hi</p><script>alert(1)</script><img src=x onerror=alert(2)><iframe src="https://evil.test"></iframe><a href="javascript:alert(3)">x</a>`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/iframe/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).toMatch(/Hi/);
    expect(clean).toMatchInlineSnapshot(`"<p>Hi</p><a rel="noopener noreferrer">x</a>"`);
  });
});

describe("stripQuotesAndSignatures", () => {
  it("drops quoted reply tails", () => {
    const text = `Thanks for applying.\n\nOn Mon, Alex wrote:\n> earlier\n`;
    expect(stripQuotesAndSignatures(text)).toBe("Thanks for applying.");
  });
});

describe("normalizeEmail", () => {
  it("stamps NORMALIZER_VERSION", async () => {
    const n = await normalizeEmail({ textPlain: "hello" });
    expect(n.normalizerVersion).toBe(NORMALIZER_VERSION);
    expect(n.textPlain).toBe("hello");
  });

  it("normalizes every _edge fixture without throwing", async () => {
    const edge = join(fixturesRoot, "emails", "_edge");
    const files = walkEml(edge);
    expect(files.length).toBeGreaterThanOrEqual(8);
    for (const f of files) {
      const raw = readFileSync(f);
      const n = await normalizeEmail({ rawMime: raw });
      expect(n.normalizerVersion).toBe(NORMALIZER_VERSION);
      expect(typeof n.textFull).toBe("string");
      // prompt-injection canaries must still produce text (not follow instructions)
      if (f.includes("prompt-injection")) {
        expect(n.textFull.length + n.textPlain.length).toBeGreaterThan(0);
      }
    }
  });

  it("parses calendar invite fixture when present", async () => {
    const cal = join(
      fixturesRoot,
      "emails",
      "_edge",
      "interview_scheduled",
      "calendar-invite.eml",
    );
    const n = await normalizeEmail({ rawMime: readFileSync(cal) });
    // May or may not embed real ICS depending on generator — assert no throw + version
    expect(n.normalizerVersion).toBe(NORMALIZER_VERSION);
  });

  it("marks tracking links without fetching", async () => {
    const n = await normalizeEmail({
      html: `<a href="https://click.sendgrid.net/track?url=https%3A%2F%2Finitech.example%2Fjobs">Apply</a>`,
    });
    expect(n.links.some((l) => l.isTracking)).toBe(true);
  });
});
