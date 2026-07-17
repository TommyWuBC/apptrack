#!/usr/bin/env tsx
/**
 * Seed stub — demo fixtures land in M3/M10.
 * With DATABASE_URL, ensures migrations are the operator's responsibility first.
 */
console.info("[seed] M2 stub — run `pnpm migrate` then later milestones for demo seed");
if (!process.env.DATABASE_URL) {
  console.info("[seed] DATABASE_URL unset — nothing to seed");
}
