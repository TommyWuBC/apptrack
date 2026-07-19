/**
 * Worker entry — email.sync + ghost.evaluate + analytics.aggregate (M5/M12/M14).
 */
import { startWorkerPolling } from "./jobs/email-sync.js";
import { startGhostEvaluatePolling } from "./jobs/ghost-evaluate.js";
import { startAnalyticsAggregatePolling } from "./jobs/analytics-aggregate.js";
import { startBossWorker } from "./jobs/boss.js";

console.info(
  "[worker] starting — email.sync + ghost.evaluate + analytics.aggregate",
);

if (process.env.WORKER_STUB_EXIT === "1") {
  console.info("[worker] WORKER_STUB_EXIT=1 — exiting");
  process.exit(0);
}

async function main(): Promise<void> {
  const jobsMode = process.env.JOBS_MODE ?? "boss";
  if (jobsMode === "boss") {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required when JOBS_MODE=boss");
    }
    const boss = await startBossWorker(databaseUrl);
    console.info("[worker] pg-boss workers and schedules ready");
    const stop = async () => {
      await boss.stop({ graceful: true, timeout: 30_000 });
      process.exit(0);
    };
    process.once("SIGTERM", () => void stop());
    process.once("SIGINT", () => void stop());
    return;
  }

  await Promise.all([
    startWorkerPolling(),
    startGhostEvaluatePolling(),
    startAnalyticsAggregatePolling(),
  ]);
}

void main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
