import type { FastifyInstance } from "fastify";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Serve the browser analytics SDK at GET /sdk.js (AGENTS.md §20.2 / M15).
 * Resolves the built artifact from @apptrack/analytics-sdk.
 */
export function resolveSdkJsPath(): string | null {
  const candidates: string[] = [];

  try {
    const resolved = import.meta.resolve("@apptrack/analytics-sdk/sdk.js");
    candidates.push(fileURLToPath(resolved));
  } catch {
    /* package export may be missing before first build */
  }

  // Workspace-relative fallbacks (dev / monorepo layouts)
  const here = dirname(fileURLToPath(import.meta.url));
  candidates.push(
    join(here, "../../../../packages/analytics-sdk/dist/sdk.js"),
    join(process.cwd(), "packages/analytics-sdk/dist/sdk.js"),
    join(process.cwd(), "../packages/analytics-sdk/dist/sdk.js"),
  );

  for (const p of candidates) {
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

export async function registerSdkRoutes(app: FastifyInstance): Promise<void> {
  app.get("/sdk.js", async (_req, reply) => {
    const path = resolveSdkJsPath();
    if (!path) {
      return reply.code(503).type("text/plain").send("sdk.js not built");
    }
    const body = readFileSync(path);
    return reply
      .header("cache-control", "public, max-age=300")
      .header("access-control-allow-origin", "*")
      .type("application/javascript; charset=utf-8")
      .send(body);
  });
}
