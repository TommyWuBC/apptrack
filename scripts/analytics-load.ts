/**
 * Lightweight analytics ingest load helper (M14).
 * Usage: pnpm exec tsx scripts/analytics-load.ts --url http://127.0.0.1:3000 --site-key pk_xxx --n 200
 */
import { randomUUID } from "node:crypto";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing ${name}`);
}

const base = arg("--url", "http://127.0.0.1:3000").replace(/\/$/, "");
const siteKey = arg("--site-key", "pk_load_test_key");
const n = Number.parseInt(arg("--n", "50"), 10);

async function one(): Promise<number> {
  const started = performance.now();
  const res = await fetch(`${base}/api/v1/analytics/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:4321",
    },
    body: JSON.stringify({
      siteKey,
      events: [
        {
          eventId: randomUUID(),
          eventType: "page_view",
          path: "/",
          occurredAt: new Date().toISOString(),
          props: { title: "Load" },
        },
      ],
    }),
  });
  const ms = performance.now() - started;
  if (!res.ok && res.status !== 401 && res.status !== 429) {
    throw new Error(`status ${res.status}: ${await res.text()}`);
  }
  return ms;
}

const times: number[] = [];
for (let i = 0; i < n; i++) {
  times.push(await one());
}
times.sort((a, b) => a - b);
const p50 = times[Math.floor(times.length * 0.5)]!;
const p99 = times[Math.min(times.length - 1, Math.floor(times.length * 0.99))]!;
console.info(
  JSON.stringify(
    { n, p50_ms: Number(p50.toFixed(2)), p99_ms: Number(p99.toFixed(2)) },
    null,
    2,
  ),
);
