/**
 * email.sync poller. AGENTS.md §23 / M5
 * Calls the server sync API so orchestration stays in apps/server (no cross-app imports).
 * pg-boss transactional enqueue lands with email.normalize (M6).
 */
const intervalMs =
  Number.parseInt(process.env.SYNC_POLL_INTERVAL_MS ?? "", 10) ||
  10 * 60 * 1000;

function baseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function triggerSyncRun(accountId?: string): Promise<unknown> {
  const res = await fetch(`${baseUrl()}/api/v1/sync/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-apptrack-internal":
        process.env.INTERNAL_JOB_SECRET ??
        process.env.SESSION_SECRET ??
        "apptrack-development-internal-secret-not-for-production",
    },
    body: JSON.stringify(accountId ? { accountId } : {}),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    throw Object.assign(new Error(`sync_run_${res.status}`), {
      status: res.status,
      body,
    });
  }
  return body;
}

export async function startWorkerPolling(): Promise<void> {
  if (process.env.SYNC_POLL_DISABLED === "1") {
    console.info("[worker] SYNC_POLL_DISABLED=1 — idle");
    return;
  }

  const tick = async () => {
    try {
      const body = await triggerSyncRun();
      console.info("[worker] email.sync ok", JSON.stringify(body));
    } catch (err) {
      const status = (err as { status?: number }).status;
      // 404 = no account yet; 503 = server/db down — expected early in boot
      if (status === 404 || status === 503) {
        console.info(
          `[worker] email.sync skipped (HTTP ${status}) — waiting for account/server`,
        );
        return;
      }
      console.error("[worker] email.sync failed", (err as Error).message);
    }
  };

  console.info(
    `[worker] email.sync poll every ${intervalMs}ms → ${baseUrl()}/api/v1/sync/run`,
  );
  await tick();
  setInterval(() => {
    void tick();
  }, intervalMs);
}
