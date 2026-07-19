/**
 * M3 acceptance: every fixture .eml parses with mailparser;
 * every sibling expected.json validates against FixtureExpectedV1Schema.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { simpleParser } from "mailparser";
import { describe, expect, it } from "vitest";
import { FixtureExpectedV1Schema, EventType } from "@apptrack/shared";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMAILS = join(ROOT, "fixtures", "emails");

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p, acc);
    else if (name.name.endsWith(".eml")) acc.push(p);
  }
  return acc;
}

describe("synthetic email fixtures (M3)", () => {
  const emlFiles = walk(EMAILS);

  it("has at least 60 fixtures", () => {
    expect(emlFiles.length).toBeGreaterThanOrEqual(60);
  });

  it("covers every FR-1 event type at least once", () => {
    const seen = new Set<string>();
    for (const eml of emlFiles) {
      const exp = eml.replace(/\.eml$/, ".expected.json");
      const raw = JSON.parse(readFileSync(exp, "utf8"));
      seen.add(FixtureExpectedV1Schema.parse(raw).eventType);
    }
    for (const et of Object.values(EventType)) {
      expect(seen.has(et), `missing event type ${et}`).toBe(true);
    }
  });

  it("covers at least 6 ATS folders", () => {
    const ats = new Set(
      readdirSync(EMAILS, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== ".")
        .map((d) => d.name),
    );
    // exclude _edge
    ats.delete("_edge");
    expect(ats.size).toBeGreaterThanOrEqual(6);
  });

  it("every .eml has a valid expected.json and parses with mailparser", async () => {
    expect(emlFiles.length).toBeGreaterThan(0);
    for (const eml of emlFiles) {
      const expPath = eml.replace(/\.eml$/, ".expected.json");
      expect(existsSync(expPath), `missing ${expPath}`).toBe(true);
      const expected = FixtureExpectedV1Schema.parse(
        JSON.parse(readFileSync(expPath, "utf8")),
      );
      expect(expected.eventType).toBeTruthy();

      const buf = readFileSync(eml);
      const parsed = await simpleParser(buf);
      expect(parsed).toBeTruthy();
      // Subject may be encoded; parser should yield a string or undefined, never throw
      expect(parsed.subject === undefined || typeof parsed.subject === "string").toBe(
        true,
      );
    }
  }, 120_000);
});
