import { createDb, closeDb, type Database } from "./client.js";
import { uuidv7 } from "./ids.js";
import * as schema from "./schema/index.js";
import * as repos from "./repos/index.js";

export { createDb, closeDb, uuidv7, schema, repos };
export type { Database };

export function dbHealth(db?: Database): {
  ok: true;
  package: "db";
  ready: boolean;
} {
  return { ok: true, package: "db", ready: Boolean(db) };
}

export const DB_PACKAGE = "@apptrack/db" as const;
