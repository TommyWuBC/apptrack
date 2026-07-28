/**
 * CSRF + authenticated mutation tests (need Postgres). AGENTS.md §24.8 T5
 */
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createDb, closeDb, repos, type Database } from "@apptrack/db";
import { loadAuthConfig } from "../config.js";
import {
  hashPassword,
  generateSessionToken,
  hashSessionToken,
  generateCsrfToken,
} from "../auth/security.js";

const dbUrl = process.env.DATABASE_URL;
const describeDb = dbUrl ? describe : describe.skip;

describeDb("auth + CSRF integration (T3/T5)", () => {
  let db: Database;

  afterEach(async () => {
    if (db) await closeDb(db);
  });

  async function seedSession(): Promise<{
    cookie: string;
    csrf: string;
  }> {
    db = createDb(dbUrl!);
    const email = `owner-csrf-${Date.now()}@example.test`;
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    const user = await repos.usersRepo.createUser(db, {
      email,
      passwordHash,
      role: "owner",
    });
    const auth = loadAuthConfig();
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + auth.sessionAbsoluteMs);
    const idleExpiresAt = new Date(Date.now() + auth.sessionIdleMs);
    await repos.sessionsRepo.createSession(db, {
      tokenHash,
      userId: user.id,
      expiresAt,
      idleExpiresAt,
      ipCountry: null,
    });
    const csrf = generateCsrfToken(tokenHash, auth.sessionSecret);
    return {
      cookie: `apptrack_session=${token}; apptrack_csrf=${csrf}`,
      csrf,
    };
  }

  it("mutation without CSRF header → 403", async () => {
    const { cookie } = await seedSession();
    const app = await buildApp({
      logger: false,
      databaseUrl: dbUrl,
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toBe("csrf_token_invalid");
    await app.close();
  });

  it("mutation with matching CSRF → succeeds (not 403)", async () => {
    const { cookie, csrf } = await seedSession();
    const app = await buildApp({
      logger: false,
      databaseUrl: dbUrl,
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie,
        "x-csrf-token": csrf,
      },
    });
    expect(res.statusCode).not.toBe(403);
    expect([200, 204]).toContain(res.statusCode);
    await app.close();
  });
});
