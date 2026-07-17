import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decodeEncryptionKey,
  decrypt,
  encrypt,
  packEncrypted,
  unpackEncrypted,
} from "./index.js";

describe("crypto AES-256-GCM", () => {
  const key = randomBytes(32);
  const keyId = "k1";

  it("round-trips a string", () => {
    const enc = encrypt("refresh-token-secret", key, keyId);
    const plain = decrypt(enc, key).toString("utf8");
    expect(plain).toBe("refresh-token-secret");
    expect(enc.keyId).toBe(keyId);
  });

  it("round-trips via pack/unpack", () => {
    const enc = encrypt(Buffer.from("access-token"), key, keyId);
    const packed = packEncrypted(enc);
    const restored = unpackEncrypted(packed, keyId);
    expect(decrypt(restored, key).toString("utf8")).toBe("access-token");
  });

  it("detects tampering", () => {
    const enc = encrypt("sensitive", key, keyId);
    enc.ciphertext[0] = (enc.ciphertext[0]! ^ 0xff) & 0xff;
    expect(() => decrypt(enc, key)).toThrow();
  });

  it("rejects wrong key", () => {
    const enc = encrypt("sensitive", key, keyId);
    const other = randomBytes(32);
    expect(() => decrypt(enc, other)).toThrow();
  });

  it("validates base64 key length", () => {
    const good = randomBytes(32).toString("base64");
    expect(decodeEncryptionKey(good)).toHaveLength(32);
    expect(() => decodeEncryptionKey("too-short")).toThrow(/32 bytes/);
  });
});
