/**
 * Worker entry — email.sync + ghost.evaluate poll loops (M5 / M12).
 * pg-boss lands with fuller job infra.
 */
import { startWorkerPolling } from "./jobs/email-sync.js";
import { startGhostEvaluatePolling } from "./jobs/ghost-evaluate.js";

console.info("[worker] starting — email.sync + ghost.evaluate");

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

setInterval(() => {}, 60_000);
