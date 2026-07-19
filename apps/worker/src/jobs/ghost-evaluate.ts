/**
 * ghost.evaluate poller. AGENTS.md §23 / M12
 * Calls the server API so orchestration stays in apps/server (same pattern as email.sync).
 */
import { callInternalApi } from "../internal-api.js";

const intervalMs =
  Number.parseInt(process.env.GHOST_EVAL_INTERVAL_MS ?? "", 10) || 24 * 60 * 60 * 1000;

export async function triggerGhostEvaluate(userId?: string): Promise<unknown> {
  return callInternalApi("POST", "/api/v1/ghost/evaluate", userId ? { userId } : {});
}

export async function startGhostEvaluatePolling(): Promise<void> {
  if (process.env.GHOST_EVAL_DISABLED === "1") {
    console.info("[ghost.evaluate] disabled via GHOST_EVAL_DISABLED=1");
    return;
  }
  const tick = async () => {
    try {
      const out = await triggerGhostEvaluate();
      console.info("[ghost.evaluate] ok", out);
    } catch (err) {
      console.error("[ghost.evaluate] failed", err);
    }
  };
  // First run after a short delay so server can boot; then daily.
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), intervalMs);
  }, 60_000);
}
