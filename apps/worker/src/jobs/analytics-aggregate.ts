/**
 * analytics.aggregate poller. AGENTS.md §23 / M14
 * Calls server API (same pattern as email.sync / ghost.evaluate).
 */
const intervalMs =
  Number.parseInt(process.env.ANALYTICS_AGGREGATE_INTERVAL_MS ?? "", 10) ||
  5 * 60 * 1000;

function baseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function triggerAnalyticsAggregate(): Promise<unknown> {
  const res = await fetch(`${baseUrl()}/api/v1/analytics/aggregate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-apptrack-internal":
        process.env.INTERNAL_JOB_SECRET ??
        process.env.SESSION_SECRET ??
        "apptrack-development-internal-secret-not-for-production",
    },
    body: "{}",
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    throw Object.assign(new Error(`analytics_aggregate_${res.status}`), {
      status: res.status,
      body,
    });
  }
  return body;
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
