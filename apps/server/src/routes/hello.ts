import type { FastifyInstance } from "fastify";

/** M1 hello-world route — proves the server package boots. */
export async function registerHelloRoutes(app: FastifyInstance) {
  app.get("/api/v1/hello", async () => ({
    message: "apptrack",
    version: "0.0.0",
    milestone: "M1",
  }));
}
