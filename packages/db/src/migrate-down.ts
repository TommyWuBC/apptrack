/**
 * Roll back the latest additive migration for migration round-trip tests.
 * The initial schema is intentionally not down-migratable; restoring a backup
 * is the production rollback path for destructive changes.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), "migrations");
const journal = JSON.parse(
  await readFile(resolve(migrationsFolder, "meta/_journal.json"), "utf8"),
) as { entries: Array<{ when: number; tag: string }> };

const client = postgres(url, { max: 1 });
try {
  const rows = await client<
    Array<{ id: number; created_at: string | number }>
  >`SELECT id, created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC
    LIMIT 1`;
  const latest = rows[0];
  if (!latest) throw new Error("No applied migration to roll back");
  const entry = journal.entries.find(
    (candidate) => candidate.when === Number(latest.created_at),
  );
  if (!entry) {
    throw new Error(`Applied migration ${latest.created_at} is not in journal`);
  }
  if (entry.tag.startsWith("0000_")) {
    throw new Error(
      "The initial migration is not down-migratable; restore a backup instead",
    );
  }
  const downPath = resolve(migrationsFolder, `${entry.tag}.down.sql`);
  const source = await readFile(downPath, "utf8");
  const statements = source
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await client.begin(async (transaction) => {
    for (const statement of statements) {
      await transaction.unsafe(statement);
    }
    await transaction`
      DELETE FROM drizzle.__drizzle_migrations
      WHERE id = ${latest.id}
    `;
  });
  console.info(`Rolled back ${entry.tag}`);
} finally {
  await client.end();
}
