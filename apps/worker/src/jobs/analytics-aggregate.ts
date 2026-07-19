/**
 * analytics.aggregate poller. AGENTS.md §23 / M14
 * Calls server API (same pattern as email.sync / ghost.evaluate).
 */
import { callInternalApi } from "../internal-api.js";

const intervalMs =
  Number.parseInt(process.env.ANALYTICS_AGGREGATE_INTERVAL_MS ?? "", 10) ||
  5 * 60 * 1000;

export async function triggerAnalyticsAggregate(): Promise<unknown> {
  return callInternalApi("POST", "/api/v1/analytics/aggregate", {});
}

export async function startAnalyticsAggregatePolling(): Promise<void> {
  if (process.env.ANALYTICS_AGGREGATE_DISABLED === "1") {
    console.info(
      "[analytics.aggregate] disabled via ANALYTICS_AGGREGATE_DISABLED=1",
    );
    return;
  }
  const tick = async () => {
    try {
      const out = await triggerAnalyticsAggregate();
      console.info("[analytics.aggregate] ok", out);
    } catch (err) {
      console.error("[analytics.aggregate] failed", err);
    }
  };
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), intervalMs);
  }, 90_000);
}
