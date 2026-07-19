/**
 * ghost.evaluate poller. AGENTS.md §23 / M12
 * Calls the server API so orchestration stays in apps/server (same pattern as email.sync).
 */
const intervalMs =
  Number.parseInt(process.env.GHOST_EVAL_INTERVAL_MS ?? "", 10) ||
  24 * 60 * 60 * 1000;

function baseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function triggerGhostEvaluate(userId?: string): Promise<unknown> {
  const res = await fetch(`${baseUrl()}/api/v1/ghost/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(userId ? { userId } : {}),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    throw Object.assign(new Error(`ghost_evaluate_${res.status}`), {
      status: res.status,
      body,
    });
  }
  return body;
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
