/**
 * Typed API client for the SPA. Talks to /api/v1 (Vite proxy in dev).
 * When VITE_DEMO=1 (or ?demo=1), returns fixture data so the UI is navigable offline.
 */
import { demoStore } from "./demo-data.js";
import type {
  ApplicationRow,
  CompanyRow,
  EvidenceResponse,
  StatsResponse,
  TimelineResponse,
} from "./types.js";

export type {
  ApplicationRow,
  CompanyRow,
  EvidenceResponse,
  RateStat,
  StatsResponse,
  TimelineEvent,
  TimelineResponse,
} from "./types.js";

function demoEnabled(): boolean {
  if (import.meta.env.VITE_DEMO === "1") return true;
  if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search).get("demo") === "1";
  }
  return false;
}

async function apiGet<T>(path: string): Promise<T> {
  if (demoEnabled()) {
    return demoStore.get(path) as T;
  }
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () =>
    apiGet<{ userId: string | null; setupRequired: boolean }>("/api/v1/me"),
  applications: (userId?: string) =>
    apiGet<{ applications: ApplicationRow[]; userId?: string }>(
      userId
        ? `/api/v1/applications?userId=${encodeURIComponent(userId)}`
        : "/api/v1/applications",
    ),
  application: (id: string) =>
    apiGet<{
      application: ApplicationRow & { companyId: string };
      company: CompanyRow | null;
      reducerVersion: string;
    }>(`/api/v1/applications/${id}`),
  timeline: (id: string) =>
    apiGet<TimelineResponse>(`/api/v1/applications/${id}/timeline`),
  stats: (userId?: string) =>
    apiGet<StatsResponse>(
      userId
        ? `/api/v1/stats?userId=${encodeURIComponent(userId)}`
        : "/api/v1/stats",
    ),
  companies: () => apiGet<{ companies: CompanyRow[] }>("/api/v1/companies"),
  evidence: (messageId: string) =>
    apiGet<EvidenceResponse>(`/api/v1/emails/${messageId}/evidence`),
  isDemo: demoEnabled,
};
