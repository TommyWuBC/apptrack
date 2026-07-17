import type { FastifyInstance } from "fastify";

/** Public liveness / readiness. AGENTS.md §22 */
export async function registerHealthRoutes(
  app: FastifyInstance,
  isDbReady: () => boolean,
) {
  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async (_req, reply) => {
    const db = isDbReady();
    // pg-boss check lands with worker jobs (M5); for M2 we only gate on DB.
    const ready = db;
    if (!ready) {
      return reply
        .code(503)
        .send({ status: "not_ready", db, boss: false });
    }
    return { status: "ready", db: true, boss: false };
  });
}
