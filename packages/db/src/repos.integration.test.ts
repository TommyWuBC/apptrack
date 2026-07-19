/**
 * Integration tests against live Postgres.
 * Requires DATABASE_URL and a migrated database. Skips when unreachable.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, closeDb, type Database } from "./client.js";
import {
  usersRepo,
  accountsRepo,
  oauthCredentialsRepo,
  emailsRepo,
  applicationsRepo,
} from "./repos/index.js";

const url = process.env.DATABASE_URL;

async function canConnect(connectionString: string): Promise<boolean> {
  try {
    const db = createDb(connectionString);
    await db.$client`select 1`;
    await closeDb(db);
    return true;
  } catch {
    return false;
  }
}

const ready = url ? await canConnect(url) : false;
const describeDb = ready ? describe : describe.skip;

describeDb("db repos (integration)", () => {
  let db: Database;

  beforeAll(() => {
    db = createDb(url!);
  });

  afterAll(async () => {
    await closeDb(db);
  });

  it("creates user, account, encrypted oauth creds (INV-1)", async () => {
    const user = await usersRepo.createUser(db, {
      email: `owner-${Date.now()}@example.com`,
      passwordHash: "$argon2id$test",
    });
    expect(user.id).toBeTruthy();

    const account = await accountsRepo.createConnectedAccount(db, {
      userId: user.id,
      providerAccountEmail: "me@gmail.com",
    });

    const blob = Buffer.concat([randomBytes(12), randomBytes(16), randomBytes(32)]);
    const creds = await oauthCredentialsRepo.upsertOauthCredentials(db, {
      accountId: account.id,
      encryptedRefreshToken: blob,
      scopes: ["gmail.readonly"],
      keyId: "k1",
    });
    expect(Buffer.isBuffer(creds.encryptedRefreshToken)).toBe(true);
    expect(creds.encryptedRefreshToken.equals(blob)).toBe(true);

    await expect(
      oauthCredentialsRepo.upsertOauthCredentials(db, {
        accountId: account.id,
        // @ts-expect-error intentional INV-1 probe
        encryptedRefreshToken: "plaintext-token",
        scopes: [],
        keyId: "k1",
      }),
    ).rejects.toThrow(/INV-1/);
  });

  it("idempotent email insert (INV-2)", async () => {
    const user = await usersRepo.createUser(db, {
      email: `mail-${Date.now()}@example.com`,
      passwordHash: "x",
    });
    const account = await accountsRepo.createConnectedAccount(db, {
      userId: user.id,
      providerAccountEmail: `acc-${Date.now()}@gmail.com`,
    });

    const input = {
      accountId: account.id,
      providerMessageId: `msg-${Date.now()}`,
      providerThreadId: `thr-${Date.now()}`,
      internalDate: new Date(),
      subject: "Thanks for applying to Initech",
    };

    const first = await emailsRepo.insertEmailMessageIdempotent(db, input);
    expect(first.inserted).toBe(true);
    const second = await emailsRepo.insertEmailMessageIdempotent(db, input);
    expect(second.inserted).toBe(false);
    expect(second.row.id).toBe(first.row.id);
  });

  it("append-only application events (INV-9)", async () => {
    const user = await usersRepo.createUser(db, {
      email: `app-${Date.now()}@example.com`,
      passwordHash: "x",
    });
    const company = await applicationsRepo.createCompany(db, `Initech ${Date.now()}`);
    const app = await applicationsRepo.createApplication(db, {
      userId: user.id,
      companyId: company.id,
      currentState: "applied",
    });
    const ev = await applicationsRepo.appendApplicationEvent(db, {
      applicationId: app.id,
      eventType: "application_confirmation",
      occurredAt: new Date(),
      source: "email",
      payload: { company: "Initech" },
    });
    expect(ev.id).toBeTruthy();
    const events = await applicationsRepo.listEventsForApplication(db, app.id);
    expect(events).toHaveLength(1);
  });
});

if (!ready) {
  describe("db repos (integration skipped)", () => {
    it("skips when DATABASE_URL missing or Postgres unreachable", () => {
      expect(ready).toBe(false);
    });
  });
}
