/**
 * Sync / backfill HTTP routes. AGENTS.md §22
 */
import type { FastifyInstance } from "fastify";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ErrorCode } from "@apptrack/shared";
import {
  createMockEmailProvider,
  createGmailEmailProvider,
  type EmailProvider,
} from "@apptrack/providers";
import { decrypt, unpackEncrypted } from "@apptrack/core";
import { repos } from "@apptrack/db";
import type { ServerConfig } from "../config.js";
import { refreshGmailAccount } from "../services/gmail-oauth-service.js";
import {
  getSyncStatus,
  runEmailBackfill,
  runEmailSync,
} from "../services/email-sync-service.js";

function defaultFixturesRoot(): string {
  if (process.env.FIXTURES_ROOT) return process.env.FIXTURES_ROOT;
  // apps/server/src/routes → repo/fixtures
  return join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../fixtures",
  );
}

/** Resolve provider for an account: mock when EMAIL_PROVIDER=mock, else Gmail. */
export async function resolveEmailProvider(
  app: FastifyInstance,
  config: ServerConfig | null,
  accountId: string,
): Promise<EmailProvider> {
  const mode = process.env.EMAIL_PROVIDER ?? "mock";
  if (mode === "mock") {
    return createMockEmailProvider(defaultFixturesRoot());
  }

  if (!config) {
    throw new Error("GOOGLE OAuth config required for gmail provider");
  }
  if (!app.db) throw new Error("database unavailable");

  const getAccessToken = async () => {
    const creds = await repos.oauthCredentialsRepo.getOauthCredentialsByAccountId(
      app.db!,
      accountId,
    );
    if (!creds?.encryptedAccessToken) {
      throw new Error("credentials_missing");
    }
    const expires = creds.accessTokenExpiresAt?.getTime() ?? 0;
    if (expires < Date.now() + 120_000) {
      await refreshGmailAccount(app.db!, config, accountId);
      const again =
        await repos.oauthCredentialsRepo.getOauthCredentialsByAccountId(
          app.db!,
          accountId,
        );
      if (!again?.encryptedAccessToken) throw new Error("credentials_missing");
      return decrypt(
        unpackEncrypted(again.encryptedAccessToken, again.keyId),
        config.encryptionKey,
      ).toString("utf8");
    }
    return decrypt(
      unpackEncrypted(creds.encryptedAccessToken, creds.keyId),
      config.encryptionKey,
    ).toString("utf8");
  };

  return createGmailEmailProvider({ tokens: { getAccessToken } });
}

export async function registerSyncRoutes(
  app: FastifyInstance,
  config: ServerConfig | null,
) {
  app.post("/api/v1/sync/run", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const body = (req.body ?? {}) as { accountId?: string };
    const userId =
      req.userId ?? (await repos.usersRepo.getFirstUser(app.db))?.id;
    if (!userId) {
      return reply.code(404).send({
        error: { code: ErrorCode.SETUP_REQUIRED, message: "setup_required" },
      });
    }
    const accounts = await repos.accountsRepo.listAccountsForUser(
      app.db,
      userId,
    );
    const account =
      (body.accountId
        ? accounts.find((a) => a.id === body.accountId)
        : accounts.find((a) => a.status === "active")) ?? null;
    if (!account) {
      return reply.code(404).send({
        error: { code: ErrorCode.NOT_FOUND, message: "no active account" },
      });
    }
    try {
      const provider = await resolveEmailProvider(app, config, account.id);
      const result = await runEmailSync(app.db, provider, account.id);
      return { result };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "REAUTH_REQUIRED") {
        return reply.code(401).send({
          error: {
            code: ErrorCode.REAUTH_REQUIRED,
            message: "reconnect Gmail",
          },
        });
      }
      throw err;
    }
  });

  app.get("/api/v1/sync/status", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const q = req.query as { accountId?: string };
    const userId =
      req.userId ?? (await repos.usersRepo.getFirstUser(app.db))?.id;
    if (!userId) {
      return reply.code(404).send({
        error: { code: ErrorCode.SETUP_REQUIRED, message: "setup_required" },
      });
    }
    const accounts = await repos.accountsRepo.listAccountsForUser(
      app.db,
      userId,
    );
    if (q.accountId) {
      const status = await getSyncStatus(app.db, q.accountId);
      return { status };
    }
    const statuses = [];
    for (const a of accounts) {
      statuses.push(await getSyncStatus(app.db, a.id));
    }
    return { statuses };
  });

  app.post("/api/v1/backfill", async (req, reply) => {
    if (!app.db) {
      return reply.code(503).send({
        error: { code: ErrorCode.INTERNAL, message: "database unavailable" },
      });
    }
    const body = (req.body ?? {}) as {
      accountId?: string;
      afterDate?: string;
      maxMessages?: number;
    };
    if (!body.afterDate) {
      return reply.code(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "afterDate required (ISO date)",
        },
      });
    }
    const userId =
      req.userId ?? (await repos.usersRepo.getFirstUser(app.db))?.id;
    if (!userId) {
      return reply.code(404).send({
        error: { code: ErrorCode.SETUP_REQUIRED, message: "setup_required" },
      });
    }
    const accounts = await repos.accountsRepo.listAccountsForUser(
      app.db,
      userId,
    );
    const account =
      (body.accountId
        ? accounts.find((a) => a.id === body.accountId)
        : accounts.find((a) => a.status === "active")) ?? null;
    if (!account) {
      return reply.code(404).send({
        error: { code: ErrorCode.NOT_FOUND, message: "no active account" },
      });
    }
    const provider = await resolveEmailProvider(app, config, account.id);
    const result = await runEmailBackfill(app.db, provider, account.id, {
      afterDate: new Date(body.afterDate),
      maxMessages: body.maxMessages ?? 500,
    });
    return { result };
  });
}
