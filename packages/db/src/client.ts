import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Database = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 10 });
  const db = drizzle(client, { schema });
  return Object.assign(db, { $client: client });
}

export async function closeDb(db: Database): Promise<void> {
  await db.$client.end({ timeout: 5 });
}
