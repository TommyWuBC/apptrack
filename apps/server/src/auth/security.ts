import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function csrfSignature(sessionHash: string, nonce: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${sessionHash}:${nonce}`, "utf8")
    .digest("base64url");
}

export function generateCsrfToken(sessionHash: string, secret: string): string {
  const nonce = randomBytes(24).toString("base64url");
  return `${nonce}.${csrfSignature(sessionHash, nonce, secret)}`;
}

export function verifyCsrfToken(
  token: string,
  sessionHash: string,
  secret: string,
): boolean {
  const [nonce, signature, extra] = token.split(".");
  if (!nonce || !signature || extra) return false;
  const expected = csrfSignature(sessionHash, nonce, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
