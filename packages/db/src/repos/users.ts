import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { uuidv7 } from "../ids.js";
import { users } from "../schema/index.js";

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  role?: string;
};

export async function createUser(db: Database, input: CreateUserInput) {
  const id = uuidv7();
  const [row] = await db
    .insert(users)
    .values({
      id,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role ?? "owner",
    })
    .returning();
  return row!;
}

export async function getUserByEmail(db: Database, email: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function getUserById(db: Database, id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function countUsers(db: Database): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users);
  return rows.length;
}
