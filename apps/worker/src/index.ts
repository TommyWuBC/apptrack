/**
 * Worker entry — email.sync poll loop (M5). pg-boss lands with M6 handoff.
 */
import { startWorkerPolling } from "./jobs/email-sync.js";

console.info("[worker] starting — M5 email.sync poll");

if (process.env.WORKER_STUB_EXIT === "1") {
  console.info("[worker] WORKER_STUB_EXIT=1 — exiting");
  process.exit(0);
}

void startWorkerPolling().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});

setInterval(() => {}, 60_000);
