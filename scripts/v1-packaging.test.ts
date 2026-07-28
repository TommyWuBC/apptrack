/**
 * v1 packaging smoke — required open-source artifacts present. M18–M20
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED = [
  "LICENSE",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "PRIVACY.md",
  "SECURITY.md",
  "THREAT_MODEL.md",
  "README.md",
  "ARCHITECTURE.md",
  "docs/setup.md",
  "docs/interview-preparation.md",
  "docs/data-retention.md",
  "docs/v1-acceptance.md",
  "docs/demo-storyboard.md",
  "docs/adr/0013-project-name-and-license.md",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  ".github/dependabot.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "scripts/backup.sh",
  "scripts/restore.sh",
  "scripts/docker-entrypoint-server.sh",
];

describe("v1 packaging artifacts", () => {
  it.each(REQUIRED)("%s exists", (rel) => {
    expect(existsSync(join(root, rel)), rel).toBe(true);
  });

  it("package.json is 1.0.0", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      version: string;
      name: string;
    };
    expect(pkg.name).toBe("apptrack");
    expect(pkg.version).toBe("1.0.0");
  });
});
