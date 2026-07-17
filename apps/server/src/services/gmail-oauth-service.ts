/**
 * Gmail OAuth orchestration. AGENTS.md M4 / §22
 * Encrypts tokens in-process (core crypto) then stores via db oauth repo (INV-1).
 * Never returns plaintext tokens in API payloads (INV-4).
 */
import {
  encrypt,
  packEncrypted,
  unpackEncrypted,
  decrypt,
} from "@apptrack/core";
import {
  repos,
  schema,
  type Database,
} from "@apptrack/db";
import {
  buildAuthorizationUrl,
  codeChallengeS256,
  exchangeAuthorizationCode,
  fetchUserEmail,
  generateCodeVerifier,
  generateOAuthState,
  refreshAccessToken,
  revokeToken,
  type GoogleOAuthConfig,
} from "@apptrack/providers";
import { putOAuthState, takeOAuthState } from "../auth/pkce-store.js";
import type { ServerConfig } from "../config.js";

const { usersRepo, accountsRepo, oauthCredentialsRepo } = repos;

export type PublicAccountView = {
  id: string;
  provider: string;
  providerAccountEmail: string;
  status: string;
  lastSyncAt: Date | null;
};

function toPublicAccount(
  row: NonNullable<Awaited<ReturnType<typeof accountsRepo.getAccountById>>>,
): PublicAccountView {
  return {
    id: row.id,
    provider: row.provider,
    providerAccountEmail: row.providerAccountEmail,
    status: row.status,
    lastSyncAt: row.lastSyncAt,
  };
}

/** Ensure the single owner user exists (v1 single-user). */
export async function ensureOwnerUser(db: Database): Promise<string> {
  const rows = await db.select().from(schema.users).limit(1);
  if (rows[0]) return rows[0].id;
  const user = await usersRepo.createUser(db, {
    email: "owner@localhost",
    passwordHash: "bootstrap-no-login-yet",
    role: "owner",
  });
  return user.id;
}

export function beginGmailConnect(
  config: ServerConfig,
  userId: string,
): { authorizeUrl: string; state: string } {
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required");
  }
  const oauth: GoogleOAuthConfig = {
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    redirectUri: config.gmailRedirectUri,
  };
  const state = generateOAuthState();
  const codeVerifier = generateCodeVerifier();
  putOAuthState(state, { codeVerifier, userId, createdAt: Date.now() });
  const authorizeUrl = buildAuthorizationUrl(oauth, {
    state,
    codeChallenge: codeChallengeS256(codeVerifier),
  });
  return { authorizeUrl, state };
}

export async function completeGmailCallback(
  db: Database,
  config: ServerConfig,
  opts: { code: string; state: string },
): Promise<PublicAccountView> {
  const pending = takeOAuthState(opts.state);
  if (!pending) {
    throw Object.assign(new Error("invalid_oauth_state"), {
      code: "INVALID_STATE",
    });
  }
  const oauth: GoogleOAuthConfig = {
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    redirectUri: config.gmailRedirectUri,
  };
  const tokens = await exchangeAuthorizationCode(oauth, {
    code: opts.code,
    codeVerifier: pending.codeVerifier,
  });
  if (!tokens.refreshToken) {
    throw new Error("missing_refresh_token — re-consent with prompt=consent");
  }
  const email = await fetchUserEmail(tokens.accessToken);

  // Reuse account row if same mailbox already connected
  const existingAccounts = await accountsRepo.listAccountsForUser(
    db,
    pending.userId,
  );
  let account = existingAccounts.find(
    (a) =>
      a.provider === "gmail" &&
      a.providerAccountEmail === email,
  );
  if (!account) {
    account = await accountsRepo.createConnectedAccount(db, {
      userId: pending.userId,
      provider: "gmail",
      providerAccountEmail: email,
      status: "active",
    });
  } else {
    await accountsRepo.setAccountStatus(db, account.id, "active");
    account = (await accountsRepo.getAccountById(db, account.id))!;
  }

  const encRefresh = packEncrypted(
    encrypt(tokens.refreshToken, config.encryptionKey, config.encryptionKeyId),
  );
  const encAccess = packEncrypted(
    encrypt(tokens.accessToken, config.encryptionKey, config.encryptionKeyId),
  );
  await oauthCredentialsRepo.upsertOauthCredentials(db, {
    accountId: account.id,
    encryptedRefreshToken: encRefresh,
    encryptedAccessToken: encAccess,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    scopes: (tokens.scope ?? "").split(/\s+/).filter(Boolean),
    keyId: config.encryptionKeyId,
  });

  return toPublicAccount(account);
}

export async function disconnectGmailAccount(
  db: Database,
  config: ServerConfig,
  accountId: string,
): Promise<void> {
  const creds = await oauthCredentialsRepo.getOauthCredentialsByAccountId(
    db,
    accountId,
  );
  if (creds) {
    try {
      const packed = creds.encryptedRefreshToken;
      const plain = decrypt(
        unpackEncrypted(packed, creds.keyId),
        config.encryptionKey,
      ).toString("utf8");
      await revokeToken(plain);
    } catch {
      // Best-effort revoke; still delete local secrets
    }
    await oauthCredentialsRepo.deleteOauthCredentials(db, accountId);
  }
  await accountsRepo.setAccountStatus(db, accountId, "disconnected");
}

/**
 * Refresh access token; on invalid_grant → status=reauth_required (no retry loop).
 */
export async function refreshGmailAccount(
  db: Database,
  config: ServerConfig,
  accountId: string,
): Promise<{ accessTokenExpiresAt: Date }> {
  const creds = await oauthCredentialsRepo.getOauthCredentialsByAccountId(
    db,
    accountId,
  );
  if (!creds) throw new Error("credentials_missing");

  const refreshPlain = decrypt(
    unpackEncrypted(creds.encryptedRefreshToken, creds.keyId),
    config.encryptionKey,
  ).toString("utf8");

  const oauth: GoogleOAuthConfig = {
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    redirectUri: config.gmailRedirectUri,
  };

  try {
    const tokens = await refreshAccessToken(oauth, refreshPlain);
    const encAccess = packEncrypted(
      encrypt(tokens.accessToken, config.encryptionKey, config.encryptionKeyId),
    );
    const encRefresh = packEncrypted(
      encrypt(
        tokens.refreshToken ?? refreshPlain,
        config.encryptionKey,
        config.encryptionKeyId,
      ),
    );
    const expires = new Date(Date.now() + tokens.expiresIn * 1000);
    await oauthCredentialsRepo.upsertOauthCredentials(db, {
      accountId,
      encryptedRefreshToken: encRefresh,
      encryptedAccessToken: encAccess,
      accessTokenExpiresAt: expires,
      scopes: creds.scopes,
      keyId: config.encryptionKeyId,
    });
    await accountsRepo.setAccountStatus(db, accountId, "active");
    return { accessTokenExpiresAt: expires };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "invalid_grant") {
      await accountsRepo.setAccountStatus(db, accountId, "reauth_required");
      throw Object.assign(new Error("reauth_required"), {
        code: "REAUTH_REQUIRED",
      });
    }
    throw err;
  }
}

export async function listGmailAccounts(
  db: Database,
  userId: string,
): Promise<PublicAccountView[]> {
  const rows = await accountsRepo.listAccountsForUser(db, userId);
  return rows
    .filter((r) => r.provider === "gmail")
    .map((r) => toPublicAccount(r));
}
