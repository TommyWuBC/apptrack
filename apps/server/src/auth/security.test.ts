import { describe, expect, it } from "vitest";
import {
  generateCsrfToken,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyCsrfToken,
  verifyPassword,
} from "./security.js";

describe("auth security primitives", () => {
  it("hashes passwords with argon2id and verifies without exposing plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toContain("$argon2id$");
    expect(hash).not.toContain("correct horse");
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(
      true,
    );
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });

  it("stores only a SHA-256 session token hash", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(token).not.toBe(hash);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("binds CSRF tokens to a session and secret", () => {
    const sessionHash = hashSessionToken(generateSessionToken());
    const token = generateCsrfToken(sessionHash, "secret-a");
    expect(verifyCsrfToken(token, sessionHash, "secret-a")).toBe(true);
    expect(verifyCsrfToken(token, sessionHash, "secret-b")).toBe(false);
    expect(verifyCsrfToken(token, hashSessionToken("another"), "secret-a")).toBe(false);
    expect(verifyCsrfToken(`${token}x`, sessionHash, "secret-a")).toBe(false);
  });
});
