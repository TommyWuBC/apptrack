#!/usr/bin/env node
/**
 * Admin CLI stub. Full commander surface lands across later milestones.
 * AGENTS.md §26.6
 */
const [, , cmd] = process.argv;

if (cmd === "version" || cmd === "--version" || cmd === "-V") {
  console.info("apptrack 0.0.0 (M1 scaffold)");
  process.exit(0);
}

console.info(`apptrack CLI stub — unknown command: ${cmd ?? "(none)"}`);
console.info("Available: version");
process.exit(cmd ? 1 : 0);
