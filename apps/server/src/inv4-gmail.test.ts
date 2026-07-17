/**
 * INV-4: OAuth credentials must never appear in API response bodies.
 * Static guard — greps gmail route/service sources for dangerous response patterns.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = dirname(fileURLToPath(import.meta.url));

describe("INV-4 gmail response hygiene", () => {
  it("gmail route does not send raw token secrets", () => {
    const src = readFileSync(join(srcDir, "routes/gmail.ts"), "utf8");
    expect(src).toMatch(/INV-4/);
    // Forbid secret field names; accessTokenExpiresAt (metadata) is allowed.
    expect(src).not.toMatch(/refresh_token|refreshToken/);
    expect(src).not.toMatch(/access_token/);
    expect(src).not.toMatch(/\baccessToken\b(?!Expires)/);
  });

  it("PublicAccountView type has no token fields", () => {
    const src = readFileSync(
      join(srcDir, "services/gmail-oauth-service.ts"),
      "utf8",
    );
    expect(src).toMatch(/export type PublicAccountView/);
    const start = src.indexOf("export type PublicAccountView");
    const end = src.indexOf("};", start) + 2;
    const viewBlock = src.slice(start, end);
    expect(viewBlock.toLowerCase()).not.toContain("token");
  });
});
