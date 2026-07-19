/**
 * Worker entry — email.sync + ghost.evaluate + analytics.aggregate (M5/M12/M14).
 */
import { startWorkerPolling } from "./jobs/email-sync.js";
import { startGhostEvaluatePolling } from "./jobs/ghost-evaluate.js";
import { startAnalyticsAggregatePolling } from "./jobs/analytics-aggregate.js";

console.info(
  "[worker] starting — email.sync + ghost.evaluate + analytics.aggregate",
);

if (process.env.WORKER_STUB_EXIT === "1") {
  console.info("[worker] WORKER_STUB_EXIT=1 — exiting");
  process.exit(0);
}

void startWorkerPolling().catch((err) => {
  console.error("[worker] email.sync fatal", err);
  process.exit(1);
});

void startGhostEvaluatePolling().catch((err) => {
  console.error("[worker] ghost.evaluate fatal", err);
  process.exit(1);
});

void startAnalyticsAggregatePolling().catch((err) => {
  console.error("[worker] analytics.aggregate fatal", err);
  process.exit(1);
});

setInterval(() => {}, 60_000);
