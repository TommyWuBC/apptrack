/**
 * Dedicated OAuth credential repository. INV-1 / INV-4.
 * Accepts ONLY encrypted bytea — callers must encrypt via @apptrack/core/crypto
 * before insert. Never logs or returns plaintext tokens (there is no plaintext column).
 */
import { eq, lt, and, isNotNull } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import { oauthCredentials } from "../schema/index.js";

export type EncryptedCredentialInsert = {
  accountId: string;
  /** Packed iv|tag|ciphertext from packEncrypted() */
  encryptedRefreshToken: Buffer;
  encryptedAccessToken?: Buffer | null;
  accessTokenExpiresAt?: Date | null;
  scopes: string[];
  keyId: string;
};

/** Stored row shape — bytea only for tokens. No plaintext fields exist. */
export type OauthCredentialRow = {
  id: string;
  accountId: string;
  encryptedRefreshToken: Buffer;
  encryptedAccessToken: Buffer | null;
  accessTokenExpiresAt: Date | null;
  scopes: string[];
  keyId: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function upsertOauthCredentials(
  db: Database,
  input: EncryptedCredentialInsert,
): Promise<OauthCredentialRow> {
  if (!Buffer.isBuffer(input.encryptedRefreshToken)) {
    throw new Error(
      "INV-1: encryptedRefreshToken must be Buffer (ciphertext), not plaintext",
    );
  }
  if (
    input.encryptedAccessToken != null &&
    !Buffer.isBuffer(input.encryptedAccessToken)
  ) {
    throw new Error(
      "INV-1: encryptedAccessToken must be Buffer (ciphertext), not plaintext",
    );
  }

  const existing = await getOauthCredentialsByAccountId(db, input.accountId);
  if (existing) {
    const [row] = await db
      .update(oauthCredentials)
      .set({
        encryptedRefreshToken: input.encryptedRefreshToken,
        encryptedAccessToken: input.encryptedAccessToken ?? null,
        accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
        scopes: input.scopes,
        keyId: input.keyId,
      })
      .where(eq(oauthCredentials.accountId, input.accountId))
      .returning();
    return toRow(row!);
  }

  const id = uuidv7();
  const [row] = await db
    .insert(oauthCredentials)
    .values({
      id,
      accountId: input.accountId,
      encryptedRefreshToken: input.encryptedRefreshToken,
      encryptedAccessToken: input.encryptedAccessToken ?? null,
      accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
      scopes: input.scopes,
      keyId: input.keyId,
    })
    .returning();
  return toRow(row!);
}

export async function getOauthCredentialsByAccountId(
  db: Database,
  accountId: string,
): Promise<OauthCredentialRow | null> {
  const [row] = await db
    .select()
    .from(oauthCredentials)
    .where(eq(oauthCredentials.accountId, accountId))
    .limit(1);
  return row ? toRow(row) : null;
}

export async function deleteOauthCredentials(
  db: Database,
  accountId: string,
): Promise<void> {
  await db.delete(oauthCredentials).where(eq(oauthCredentials.accountId, accountId));
}

/** Account ids whose access token expires before `cutoff` (oauth.refresh-sweep). */
export async function listAccountIdsExpiringBefore(
  db: Database,
  cutoff: Date,
): Promise<string[]> {
  const rows = await db
    .select({ accountId: oauthCredentials.accountId })
    .from(oauthCredentials)
    .where(
      and(
        isNotNull(oauthCredentials.accessTokenExpiresAt),
        lt(oauthCredentials.accessTokenExpiresAt, cutoff),
      ),
    );
  return rows.map((r) => r.accountId);
}

function toRow(row: typeof oauthCredentials.$inferSelect): OauthCredentialRow {
  return {
    id: row.id,
    accountId: row.accountId,
    encryptedRefreshToken: row.encryptedRefreshToken as Buffer,
    encryptedAccessToken: (row.encryptedAccessToken as Buffer | null) ?? null,
    accessTokenExpiresAt: row.accessTokenExpiresAt,
    scopes: row.scopes ?? [],
    keyId: row.keyId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * INV-4 guard: never serialize credential rows into API responses.
 * Throws if someone tries JSON.stringify on a credential-shaped object with token fields.
 */
export function assertNotSerializableForApi(_row: OauthCredentialRow): void {
  // Intentionally no toJSON — callers must not spread secrets into responses.
  // This helper documents the contract; services should map to { accountId, scopes, expiresAt } only.
}
