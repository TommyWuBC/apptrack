/**
 * AES-256-GCM helpers. AGENTS.md §10.8
 * Keys are passed in by the caller — core never reads process.env.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedPayload = {
  ciphertext: Buffer;
  keyId: string;
  iv: Buffer;
  tag: Buffer;
};

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/** Decode a 32-byte key from base64 (APP_ENCRYPTION_KEY format). */
export function decodeEncryptionKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Encryption key must be ${KEY_LENGTH} bytes (got ${key.length}). Generate with: openssl rand -base64 32`,
    );
  }
  return key;
}

/** Encrypt plaintext with AES-256-GCM. */
export function encrypt(
  plaintext: string | Buffer,
  key: Buffer,
  keyId: string,
): EncryptedPayload {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes`);
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plainBuf =
    typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const ciphertext = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, keyId, iv, tag };
}

/** Decrypt; throws on tamper / wrong key (GCM auth tag failure). */
export function decrypt(payload: EncryptedPayload, key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes`);
  }
  const decipher = createDecipheriv("aes-256-gcm", key, payload.iv);
  decipher.setAuthTag(payload.tag);
  return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
}

/** Pack iv|tag|ciphertext into a single bytea. */
export function packEncrypted(payload: EncryptedPayload): Buffer {
  return Buffer.concat([payload.iv, payload.tag, payload.ciphertext]);
}

/** Unpack storage blob produced by packEncrypted. */
export function unpackEncrypted(packed: Buffer, keyId: string): EncryptedPayload {
  if (packed.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Encrypted blob too short");
  }
  return {
    iv: packed.subarray(0, IV_LENGTH),
    tag: packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH),
    ciphertext: packed.subarray(IV_LENGTH + TAG_LENGTH),
    keyId,
  };
}
