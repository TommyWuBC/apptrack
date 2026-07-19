import { repos, type Database } from "@apptrack/db";
import type { AuthConfig } from "../config.js";
import {
  generateCsrfToken,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "./security.js";

export type CreatedAuthSession = {
  user: { id: string; email: string; role: string };
  token: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: Date;
};

async function createAuthSession(
  db: Database,
  config: AuthConfig,
  user: { id: string; email: string; role: string },
  ipCountry?: string | null,
): Promise<CreatedAuthSession> {
  const now = new Date();
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(now.getTime() + config.sessionAbsoluteMs);
  const idleExpiresAt = new Date(now.getTime() + config.sessionIdleMs);
  await repos.sessionsRepo.createSession(db, {
    tokenHash,
    userId: user.id,
    expiresAt,
    idleExpiresAt,
    ipCountry,
  });
  return {
    user,
    token,
    tokenHash,
    csrfToken: generateCsrfToken(tokenHash, config.sessionSecret),
    expiresAt,
  };
}

export async function setupOwner(
  db: Database,
  config: AuthConfig,
  credentials: { email: string; password: string },
  ipCountry?: string | null,
) {
  if ((await repos.usersRepo.countUsers(db)) !== 0) {
    throw Object.assign(new Error("setup_already_completed"), {
      code: "CONFLICT",
    });
  }
  const user = await repos.usersRepo.createUser(db, {
    email: credentials.email,
    passwordHash: await hashPassword(credentials.password),
    role: "owner",
  });
  const session = await createAuthSession(db, config, user, ipCountry);
  await repos.correctionsRepo.writeAuditLog(db, {
    userId: user.id,
    actor: "user",
    action: "auth.setup",
    targetType: "user",
    targetId: user.id,
  });
  return session;
}

export async function loginOwner(
  db: Database,
  config: AuthConfig,
  credentials: { email: string; password: string },
  ipCountry?: string | null,
) {
  const user = await repos.usersRepo.getUserByEmail(db, credentials.email);
  if (!user || !(await verifyPassword(user.passwordHash, credentials.password))) {
    throw Object.assign(new Error("invalid_credentials"), {
      code: "UNAUTHORIZED",
    });
  }
  // v1 has one owner and rotates all sessions on login.
  await repos.sessionsRepo.deleteSessionsForUser(db, user.id);
  const session = await createAuthSession(db, config, user, ipCountry);
  await repos.correctionsRepo.writeAuditLog(db, {
    userId: user.id,
    actor: "user",
    action: "auth.login",
    targetType: "user",
    targetId: user.id,
  });
  return session;
}
