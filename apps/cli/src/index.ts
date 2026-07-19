#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import argon2 from "argon2";
import { Command } from "commander";
import { PgBoss } from "pg-boss";
import { closeDb, createDb, repos } from "@apptrack/db";
import {
  EmailBackfillJobV1Schema,
  EmailReprocessJobV1Schema,
  EmailSyncJobV1Schema,
  JobName,
} from "@apptrack/shared/jobs";

function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required");
  return value;
}

async function enqueue(
  name: string,
  data: Record<string, unknown>,
  singletonKey: string,
) {
  const boss = new PgBoss({
    connectionString: databaseUrl(),
    schema: process.env.PG_BOSS_SCHEMA ?? "pgboss",
    application_name: "apptrack-cli",
  });
  await boss.start();
  await boss.createQueue(name, {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
  });
  const id = await boss.send(name, data, { singletonKey });
  await boss.stop({ graceful: true, timeout: 10_000 });
  return id;
}

const program = new Command()
  .name("apptrack")
  .description("apptrack self-hosted administration")
  .version("0.0.0");

program
  .command("user:create")
  .requiredOption("--email <email>")
  .requiredOption("--password <password>")
  .action(async ({ email, password }: { email: string; password: string }) => {
    if (password.length < 12) throw new Error("password must be at least 12 characters");
    const db = createDb(databaseUrl());
    try {
      if ((await repos.usersRepo.countUsers(db)) > 0) {
        throw new Error("owner already exists");
      }
      const user = await repos.usersRepo.createUser(db, {
        email,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: "owner",
      });
      console.info(`created owner ${user.id}`);
    } finally {
      await closeDb(db);
    }
  });

program
  .command("sync:run")
  .option("--account-id <uuid>")
  .action(async ({ accountId }: { accountId?: string }) => {
    const payload = EmailSyncJobV1Schema.parse({ accountId });
    const id = await enqueue(
      JobName.EMAIL_SYNC,
      payload,
      `email.sync:${accountId ?? "default"}`,
    );
    console.info(`queued email.sync ${id ?? "(duplicate suppressed)"}`);
  });

program
  .command("backfill")
  .requiredOption("--after <YYYY-MM-DD>")
  .option("--before <YYYY-MM-DD>")
  .option("--account-id <uuid>")
  .action(async (opts: { after: string; before?: string; accountId?: string }) => {
    const payload = EmailBackfillJobV1Schema.parse({
      accountId: opts.accountId,
      afterDate: opts.after,
      beforeDate: opts.before,
      maxMessages: 500,
    });
    const id = await enqueue(
      JobName.EMAIL_BACKFILL,
      payload,
      `email.backfill:${opts.accountId ?? "default"}:${opts.after}:${opts.before ?? ""}`,
    );
    console.info(`queued email.backfill ${id ?? "(duplicate suppressed)"}`);
  });

program
  .command("reprocess")
  .option("--message-id <uuid...>")
  .action(async ({ messageId }: { messageId?: string[] }) => {
    const payload = EmailReprocessJobV1Schema.parse(
      messageId?.length
        ? { scope: "message_ids", messageIds: messageId }
        : { scope: "all" },
    );
    const id = await enqueue(
      JobName.EMAIL_REPROCESS,
      payload,
      `email.reprocess:${JSON.stringify(payload)}`,
    );
    console.info(`queued email.reprocess ${id ?? "(duplicate suppressed)"}`);
  });

program
  .command("export")
  .requiredOption("--out <file>")
  .action(async ({ out }: { out: string }) => {
    const db = createDb(databaseUrl());
    try {
      const user = await repos.usersRepo.getFirstUser(db);
      if (!user) throw new Error("no owner exists");
      const data = await repos.exportRepo.exportAccountData(db, user.id);
      await writeFile(out, `${JSON.stringify(data, null, 2)}\n`, {
        mode: 0o600,
      });
      console.info(`exported account data to ${out}`);
    } finally {
      await closeDb(db);
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
