import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLASSIFIER_LOGIC_HASH } from "./version.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const LOGIC_FILES = [
  "classify.ts",
  "extract.ts",
  "l3.ts",
  "ats/templates.ts",
  "rules/families.ts",
  "prompts/extract.v1.ts",
];

describe("classifier version hash", () => {
  it("changes only with an explicit version/hash update", () => {
    const hash = createHash("sha256");
    for (const relative of LOGIC_FILES) {
      hash.update(relative);
      hash.update("\0");
      hash.update(readFileSync(join(ROOT, relative)));
      hash.update("\0");
    }
    expect(hash.digest("hex")).toBe(CLASSIFIER_LOGIC_HASH);
  });
});
