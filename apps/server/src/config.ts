import { randomBytes } from "node:crypto";
import {
  decodeEncryptionKey,
  type EncryptedPayload,
} from "@apptrack/core";

export type ServerConfig = {
  appBaseUrl: string;
  encryptionKey: Buffer;
  encryptionKeyId: string;
  googleClientId: string;
  googleClientSecret: string;
  gmailRedirectUri: string;
};

export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const appBaseUrl = (env.APP_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const keyB64 = env.APP_ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error("APP_ENCRYPTION_KEY is required for Gmail OAuth");
  }
  const clientId = env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET ?? "";
  return {
    appBaseUrl,
    encryptionKey: decodeEncryptionKey(keyB64),
    encryptionKeyId: env.APP_ENCRYPTION_KEY_ID ?? "k1",
    googleClientId: clientId,
    googleClientSecret: clientSecret,
    gmailRedirectUri: `${appBaseUrl}/api/v1/gmail/callback`,
  };
}

/** Deterministic test key (32 zero bytes → base64). */
export function testEncryptionKeyBase64(): string {
  return randomBytes(32).toString("base64");
}

export type { EncryptedPayload };
