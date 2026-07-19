import { afterEach, describe, expect, it } from "vitest";
import nock from "nock";
import {
  buildAuthorizationUrl,
  codeChallengeS256,
  exchangeAuthorizationCode,
  generateCodeVerifier,
  generateOAuthState,
  refreshAccessToken,
  revokeToken,
  fetchUserEmail,
  GOOGLE_TOKEN_URL,
  GOOGLE_REVOKE_URL,
  GOOGLE_USERINFO_URL,
} from "./oauth.js";

const config = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  redirectUri: "http://localhost:3000/api/v1/gmail/callback",
};

afterEach(() => {
  nock.cleanAll();
});

describe("gmail oauth helpers", () => {
  it("builds authorize URL with PKCE S256", () => {
    const verifier = generateCodeVerifier();
    const state = generateOAuthState();
    const url = buildAuthorizationUrl(config, {
      state,
      codeChallenge: codeChallengeS256(verifier),
    });
    const u = new URL(url);
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("code_challenge")).toBe(codeChallengeS256(verifier));
    expect(u.searchParams.get("state")).toBe(state);
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("scope")).toContain("gmail.readonly");
  });

  it("exchanges authorization code (happy path)", async () => {
    nock("https://oauth2.googleapis.com").post("/token").reply(200, {
      access_token: "ya29.access",
      refresh_token: "1//refresh",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      token_type: "Bearer",
    });

    const tokens = await exchangeAuthorizationCode(config, {
      code: "auth-code",
      codeVerifier: generateCodeVerifier(),
    });
    expect(tokens.accessToken).toBe("ya29.access");
    expect(tokens.refreshToken).toBe("1//refresh");
    expect(GOOGLE_TOKEN_URL).toContain("oauth2.googleapis.com");
  });

  it("refresh rotates access token", async () => {
    nock("https://oauth2.googleapis.com").post("/token").reply(200, {
      access_token: "ya29.new",
      expires_in: 3600,
      token_type: "Bearer",
    });

    const tokens = await refreshAccessToken(config, "1//refresh");
    expect(tokens.accessToken).toBe("ya29.new");
    expect(tokens.refreshToken).toBe("1//refresh");
  });

  it("refresh surfaces invalid_grant", async () => {
    nock("https://oauth2.googleapis.com")
      .post("/token")
      .reply(400, { error: "invalid_grant" });

    await expect(refreshAccessToken(config, "bad")).rejects.toMatchObject({
      code: "invalid_grant",
    });
  });

  it("revokes a token", async () => {
    nock("https://oauth2.googleapis.com").post("/revoke").query(true).reply(200, {});
    await expect(revokeToken("1//refresh")).resolves.toBeUndefined();
    expect(GOOGLE_REVOKE_URL).toContain("revoke");
  });

  it("fetches user email", async () => {
    nock("https://www.googleapis.com")
      .get("/oauth2/v3/userinfo")
      .reply(200, { email: "Alex@Example.COM" });
    await expect(fetchUserEmail("ya29.access")).resolves.toBe("alex@example.com");
    expect(GOOGLE_USERINFO_URL).toContain("userinfo");
  });
});
