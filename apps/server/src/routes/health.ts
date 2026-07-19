import type { FastifyInstance } from "fastify";

/** Public liveness / readiness. AGENTS.md §22 */
export async function registerHealthRoutes(
  app: FastifyInstance,
  isDbReady: () => boolean,
  isBossReady: () => boolean = () => false,
) {
  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async (_req, reply) => {
    const db = isDbReady();
    const boss = isBossReady();
    const ready = db && boss;
    if (!ready) {
      return reply
        .code(503)
        .send({ status: "not_ready", db, boss });
    }
    return { status: "ready", db: true, boss: true };
  });
}
