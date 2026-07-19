import { randomBytes } from "node:crypto";
import { decodeEncryptionKey, type EncryptedPayload } from "@apptrack/core";

export type ServerConfig = {
  appBaseUrl: string;
  encryptionKey: Buffer;
  encryptionKeyId: string;
  googleClientId: string;
  googleClientSecret: string;
  gmailRedirectUri: string;
};

export type AuthConfig = {
  sessionSecret: string;
  sessionAbsoluteMs: number;
  sessionIdleMs: number;
  cookieSecure: boolean;
  cookieName: string;
  csrfCookieName: string;
  internalJobSecret: string;
};

function positiveHours(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const secret = env.SESSION_SECRET;
  if (!secret && env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  const internalJobSecret = env.INTERNAL_JOB_SECRET;
  if (!internalJobSecret && env.NODE_ENV === "production") {
    throw new Error("INTERNAL_JOB_SECRET is required in production");
  }
  if (
    env.NODE_ENV === "production" &&
    internalJobSecret &&
    secret &&
    internalJobSecret === secret
  ) {
    throw new Error("INTERNAL_JOB_SECRET must differ from SESSION_SECRET");
  }
  const absoluteHours = positiveHours(env.SESSION_ABSOLUTE_HOURS, 24 * 30);
  const idleHours = positiveHours(env.SESSION_IDLE_HOURS, 24);
  return {
    // Development/tests may use this deterministic non-secret. Production fails
    // closed above and never accepts it.
    sessionSecret: secret ?? "apptrack-development-session-secret-not-for-production",
    sessionAbsoluteMs: absoluteHours * 60 * 60 * 1000,
    sessionIdleMs: idleHours * 60 * 60 * 1000,
    cookieSecure: env.NODE_ENV === "production",
    cookieName: "apptrack_session",
    csrfCookieName: "apptrack_csrf",
    internalJobSecret:
      internalJobSecret ?? "apptrack-development-internal-secret-not-for-production",
  };
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const appBaseUrl = (env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
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
