/**
 * Apply SQL migrations from src/migrations.
 * Usage: DATABASE_URL=... pnpm --filter @apptrack/db migrate
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, "migrations");

const client = postgres(url, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder });
await client.end();
console.info("Migrations applied:", migrationsFolder);
