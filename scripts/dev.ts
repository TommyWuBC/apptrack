/**
 * `pnpm dev` — start Postgres (compose) then server + worker + Vite.
 * AGENTS.md §26
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
) {
  const child = spawn(cmd, args, {
    cwd: opts.cwd ?? root,
    env: { ...process.env, ...opts.env, Path: process.env.Path },
    stdio: "inherit",
    shell: true,
  });
  return child;
}

async function main() {
  const composeFile = resolve(root, "docker-compose.dev.yml");
  if (existsSync(composeFile)) {
    console.info("[dev] starting postgres + mailpit via docker compose…");
    await new Promise<void>((resolvePromise, reject) => {
      const c = run("docker", ["compose", "-f", "docker-compose.dev.yml", "up", "-d"]);
      c.on("exit", (code) =>
        code === 0 ? resolvePromise() : reject(new Error(`compose exit ${code}`)),
      );
    }).catch((err) => {
      console.warn("[dev] docker compose failed (is Docker running?):", err.message);
      console.warn("[dev] continuing without local Postgres — DB features need M2+");
    });
  }

  console.info("[dev] starting server :3000, worker stub, web :5173");
  const children = [
    run("pnpm", ["--filter", "@apptrack/server", "dev"]),
    run("pnpm", ["--filter", "@apptrack/worker", "dev"]),
    run("pnpm", ["--filter", "@apptrack/web", "dev"]),
  ];

  const shutdown = () => {
    for (const c of children) c.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
