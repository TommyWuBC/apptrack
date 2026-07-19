import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import nock from "nock";
import { buildApp } from "../app.js";
import { clearOAuthStates, putOAuthState } from "../auth/pkce-store.js";
import type { ServerConfig } from "../config.js";
import {
  beginGmailConnect,
  completeGmailCallback,
  disconnectGmailAccount,
  ensureOwnerUser,
  refreshGmailAccount,
} from "../services/gmail-oauth-service.js";
import { createDb, closeDb, repos, type Database } from "@apptrack/db";
import { decrypt, unpackEncrypted } from "@apptrack/core";

const testKey = randomBytes(32);
const config: ServerConfig = {
  appBaseUrl: "http://localhost:3000",
  encryptionKey: testKey,
  encryptionKeyId: "k1",
  googleClientId: "test-client-id",
  googleClientSecret: "test-client-secret",
  gmailRedirectUri: "http://localhost:3000/api/v1/gmail/callback",
};

const dbUrl = process.env.DATABASE_URL;
const describeDb = dbUrl ? describe : describe.skip;

afterEach(() => {
  nock.cleanAll();
  clearOAuthStates();
});

describe("gmail routes (no db)", () => {
  it("connect without db returns 503", async () => {
    const app = await buildApp({ logger: false, config });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/gmail/connect?format=json",
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("callback with bad state returns 400 when db present is required — without db 503", async () => {
    const app = await buildApp({ logger: false, config });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/gmail/callback?code=x&state=nope&format=json",
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("beginGmailConnect puts PKCE state and returns google URL", () => {
    const { authorizeUrl, state } = beginGmailConnect(config, "user-1");
    expect(state.length).toBeGreaterThan(10);
    expect(authorizeUrl).toContain("code_challenge");
    expect(authorizeUrl).toContain("accounts.google.com");
  });
});

describeDb("gmail oauth service (integration)", () => {
  let db: Database;

  afterEach(async () => {
    if (db) await closeDb(db);
  });

  it("happy path: exchange → encrypt → store; response has no plaintext tokens", async () => {
    db = createDb(dbUrl!);
    const userId = await ensureOwnerUser(db);

    nock("https://oauth2.googleapis.com").post("/token").reply(200, {
      access_token: "ya29.SECRET_ACCESS",
      refresh_token: "1//SECRET_REFRESH",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/gmail.readonly",
    });
    nock("https://www.googleapis.com")
      .get("/oauth2/v3/userinfo")
      .reply(200, { email: "applicant@initech.example" });

    const { state } = beginGmailConnect(config, userId);
    // state already stored by beginGmailConnect
    const account = await completeGmailCallback(db, config, {
      code: "auth-code",
      state,
    });

    expect(account.providerAccountEmail).toBe("applicant@initech.example");
    expect(JSON.stringify(account)).not.toMatch(/SECRET_/);
    expect(JSON.stringify(account)).not.toMatch(/ya29/);
    expect(JSON.stringify(account)).not.toMatch(/1\/\//);

    const creds = await repos.oauthCredentialsRepo.getOauthCredentialsByAccountId(
      db,
      account.id,
    );
    expect(creds).toBeTruthy();
    const plain = decrypt(
      unpackEncrypted(creds!.encryptedRefreshToken, creds!.keyId),
      testKey,
    ).toString("utf8");
    expect(plain).toBe("1//SECRET_REFRESH");

    // Route-level: list accounts must not leak tokens
    const app = await buildApp({
      logger: false,
      databaseUrl: dbUrl,
      config,
    });
    const list = await app.inject({ method: "GET", url: "/api/v1/gmail/accounts" });
    expect(list.statusCode).toBe(200);
    expect(list.body).not.toMatch(/SECRET_/);
    await app.close();
  });

  it("state mismatch fails loudly", async () => {
    db = createDb(dbUrl!);
    await ensureOwnerUser(db);
    putOAuthState("real-state", {
      codeVerifier: "verifier",
      userId: "u1",
      createdAt: Date.now(),
    });
    await expect(
      completeGmailCallback(db, config, { code: "c", state: "wrong" }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("invalid_grant sets reauth_required", async () => {
    db = createDb(dbUrl!);
    const userId = await ensureOwnerUser(db);

    nock("https://oauth2.googleapis.com").post("/token").reply(200, {
      access_token: "ya29.a",
      refresh_token: "1//r",
      expires_in: 3600,
    });
    nock("https://www.googleapis.com")
      .get("/oauth2/v3/userinfo")
      .reply(200, { email: "reauth@initech.example" });

    const { state } = beginGmailConnect(config, userId);
    const account = await completeGmailCallback(db, config, {
      code: "c",
      state,
    });

    nock("https://oauth2.googleapis.com")
      .post("/token")
      .reply(400, { error: "invalid_grant" });

    await expect(refreshGmailAccount(db, config, account.id)).rejects.toMatchObject({
      code: "REAUTH_REQUIRED",
    });
    const row = await repos.accountsRepo.getAccountById(db, account.id);
    expect(row?.status).toBe("reauth_required");
  });

  it("refresh rotation updates encrypted access token", async () => {
    db = createDb(dbUrl!);
    const userId = await ensureOwnerUser(db);

    nock("https://oauth2.googleapis.com").post("/token").reply(200, {
      access_token: "ya29.old",
      refresh_token: "1//r",
      expires_in: 3600,
    });
    nock("https://www.googleapis.com")
      .get("/oauth2/v3/userinfo")
      .reply(200, { email: "rotate@initech.example" });

    const { state } = beginGmailConnect(config, userId);
    const account = await completeGmailCallback(db, config, {
      code: "c",
      state,
    });

    nock("https://oauth2.googleapis.com").post("/token").reply(200, {
      access_token: "ya29.rotated",
      expires_in: 1800,
    });

    const result = await refreshGmailAccount(db, config, account.id);
    expect(result.accessTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());

    const creds = await repos.oauthCredentialsRepo.getOauthCredentialsByAccountId(
      db,
      account.id,
    );
    const access = decrypt(
      unpackEncrypted(creds!.encryptedAccessToken!, creds!.keyId),
      testKey,
    ).toString("utf8");
    expect(access).toBe("ya29.rotated");
  });

  it("disconnect revokes and deletes credentials", async () => {
    db = createDb(dbUrl!);
    const userId = await ensureOwnerUser(db);

    nock("https://oauth2.googleapis.com").post("/token").reply(200, {
      access_token: "ya29.x",
      refresh_token: "1//del",
      expires_in: 3600,
    });
    nock("https://www.googleapis.com")
      .get("/oauth2/v3/userinfo")
      .reply(200, { email: "bye@initech.example" });
    nock("https://oauth2.googleapis.com").post("/revoke").query(true).reply(200, {});

    const { state } = beginGmailConnect(config, userId);
    const account = await completeGmailCallback(db, config, {
      code: "c",
      state,
    });

    await disconnectGmailAccount(db, config, account.id, userId);
    const creds = await repos.oauthCredentialsRepo.getOauthCredentialsByAccountId(
      db,
      account.id,
    );
    expect(creds).toBeNull();
    const row = await repos.accountsRepo.getAccountById(db, account.id);
    expect(row?.status).toBe("disconnected");
  });
});

if (!dbUrl) {
  describe("gmail oauth service (skipped notice)", () => {
    it("skips integration without DATABASE_URL", () => {
      expect(dbUrl).toBeFalsy();
    });
  });
}
