/**
 * Gmail OAuth helpers (PKCE). Uses fetch — no googleapis required for M4.
 * AGENTS.md §11 / M4. R-2: provider HTTP lives in packages/providers.
 */
import { createHash, randomBytes } from "node:crypto";

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const OPENID_EMAIL_SCOPES = "openid email profile";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
  tokenType?: string;
};

export function generateCodeVerifier(): string {
  return base64Url(randomBytes(32));
}

export function codeChallengeS256(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function generateOAuthState(): string {
  return base64Url(randomBytes(24));
}

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildAuthorizationUrl(
  config: GoogleOAuthConfig,
  opts: { state: string; codeChallenge: string; scopes?: string[] },
): string {
  const scopes = opts.scopes ?? [GMAIL_READONLY_SCOPE, ...OPENID_EMAIL_SCOPES.split(" ")];
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export async function exchangeAuthorizationCode(
  config: GoogleOAuthConfig,
  opts: { code: string; codeVerifier: string },
): Promise<TokenSet> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: opts.code,
    code_verifier: opts.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(
      `token_exchange_failed: ${String(json.error ?? res.status)}`,
    ) as Error & { code?: string; payload?: unknown };
    err.code = String(json.error ?? "token_exchange_failed");
    err.payload = json;
    throw err;
  }
  return {
    accessToken: String(json.access_token),
    refreshToken: json.refresh_token != null ? String(json.refresh_token) : undefined,
    expiresIn: Number(json.expires_in ?? 3600),
    scope: json.scope != null ? String(json.scope) : undefined,
    tokenType: json.token_type != null ? String(json.token_type) : undefined,
  };
}

export async function refreshAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(
      `token_refresh_failed: ${String(json.error ?? res.status)}`,
    ) as Error & { code?: string; payload?: unknown };
    err.code = String(json.error ?? "token_refresh_failed");
    err.payload = json;
    throw err;
  }
  return {
    accessToken: String(json.access_token),
    refreshToken: json.refresh_token != null ? String(json.refresh_token) : refreshToken,
    expiresIn: Number(json.expires_in ?? 3600),
    scope: json.scope != null ? String(json.scope) : undefined,
  };
}

export async function revokeToken(token: string): Promise<void> {
  const url = new URL(GOOGLE_REVOKE_URL);
  url.searchParams.set("token", token);
  const res = await fetch(url.toString(), { method: "POST" });
  // Google returns 200 even for already-revoked; treat non-2xx as soft failure
  if (!res.ok && res.status !== 400) {
    throw new Error(`revoke_failed: ${res.status}`);
  }
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as { email?: string };
  if (!res.ok || !json.email) {
    throw new Error("userinfo_failed");
  }
  return json.email.toLowerCase();
}
