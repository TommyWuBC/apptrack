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
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("demo");
  if (q === "1") {
    sessionStorage.setItem("apptrack_demo", "1");
    return true;
  }
  if (q === "0") {
    sessionStorage.removeItem("apptrack_demo");
    return false;
  }
  return sessionStorage.getItem("apptrack_demo") === "1";
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

async function apiSend<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  if (demoEnabled()) {
    return demoStore.mutate(method, path, body) as T;
  }
  const csrfToken =
    typeof document === "undefined"
      ? null
      : document.cookie
          .split("; ")
          .find((part) => part.startsWith("apptrack_csrf="))
          ?.slice("apptrack_csrf=".length);
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(csrfToken
        ? { "x-csrf-token": decodeURIComponent(csrfToken) }
        : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export type ReviewItem = {
  id: string;
  kind: string;
  refId: string;
  status: string;
  resolution: unknown;
};

export type CorrectionRow = {
  id: string;
  field: string;
  machineValue: unknown;
  userValue: unknown;
  locked: boolean;
  revertedAt: string | null;
  createdAt: string;
};

export const api = {
  me: () =>
    apiGet<{
      userId: string;
      email: string;
      role: "owner";
      csrfToken: string;
    }>("/api/v1/auth/me"),
  authStatus: () =>
    apiGet<{ setupRequired: boolean }>("/api/v1/auth/status"),
  setup: (email: string, password: string) =>
    apiSend<{ userId: string; email: string; role: "owner"; csrfToken: string }>(
      "POST",
      "/api/v1/auth/setup",
      { email, password },
    ),
  login: (email: string, password: string) =>
    apiSend<{ userId: string; email: string; role: "owner"; csrfToken: string }>(
      "POST",
      "/api/v1/auth/login",
      { email, password },
    ),
  logout: () => apiSend<void>("POST", "/api/v1/auth/logout"),
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
  review: (kind?: string) =>
    apiGet<{ items: ReviewItem[] }>(
      kind
        ? `/api/v1/review?kind=${encodeURIComponent(kind)}`
        : "/api/v1/review",
    ),
  resolveReview: (id: string, body: unknown) =>
    apiSend<unknown>("POST", `/api/v1/review/${id}/resolve`, body),
  patchApplication: (
    id: string,
    body: {
      fields: Array<{ field: string; userValue: unknown; locked?: boolean }>;
      expectedVersion?: string;
    },
  ) => apiSend<unknown>("PATCH", `/api/v1/applications/${id}`, body),
  undoCorrection: (id: string) =>
    apiSend<unknown>("POST", `/api/v1/corrections/${id}/undo`, {}),
  mergeApplications: (survivorId: string, sourceIds: string[]) =>
    apiSend<unknown>("POST", `/api/v1/applications/${survivorId}/merge`, {
      sourceIds,
    }),
  splitApplication: (id: string, eventIds: string[]) =>
    apiSend<unknown>("POST", `/api/v1/applications/${id}/split`, {
      eventIds,
    }),
  reattachEvent: (applicationId: string, eventId: string, toApplicationId: string) =>
    apiSend<unknown>(
      "POST",
      `/api/v1/applications/${applicationId}/events/${eventId}/reattach`,
      { toApplicationId },
    ),
  mergeCompanies: (survivorCompanyId: string, sourceCompanyId: string) =>
    apiSend<unknown>("POST", "/api/v1/companies/merge", {
      survivorCompanyId,
      sourceCompanyId,
    }),
  corrections: (applicationId: string) =>
    apiGet<{ applicationId: string; corrections: CorrectionRow[] }>(
      `/api/v1/applications/${applicationId}/corrections`,
    ),
  ghostSettings: () =>
    apiGet<{
      userId: string | null;
      thresholds: {
        staleAfterDays: number;
        ghostAfterDays: number;
        perStage: Record<string, { staleAfterDays: number; ghostAfterDays: number }>;
        perType: Record<string, { staleAfterDays: number; ghostAfterDays: number }>;
        perCompany: Record<string, { staleAfterDays: number; ghostAfterDays: number }>;
      };
      algorithmVersion: string;
    }>("/api/v1/settings/ghost"),
  updateGhostSettings: (thresholds: {
    staleAfterDays: number;
    ghostAfterDays: number;
    perStage?: Record<string, { staleAfterDays: number; ghostAfterDays: number }>;
    perType?: Record<string, { staleAfterDays: number; ghostAfterDays: number }>;
    perCompany?: Record<string, { staleAfterDays: number; ghostAfterDays: number }>;
  }) =>
    apiSend<{ thresholds: unknown; algorithmVersion: string }>(
      "PATCH",
      "/api/v1/settings/ghost",
      { thresholds },
    ),
  evaluateGhosts: () =>
    apiSend<{
      algorithmVersion: string;
      scanned: number;
      transitions: unknown[];
    }>("POST", "/api/v1/ghost/evaluate", {}),
  dismissGhost: (applicationId: string) =>
    apiSend<unknown>(
      "POST",
      `/api/v1/applications/${applicationId}/ghost/dismiss`,
      {},
    ),
  notifications: () =>
    apiGet<{
      notifications: Array<{
        id: string;
        kind: string;
        title: string;
        body: string | null;
        link: string | null;
        readAt: string | null;
      }>;
      userId: string | null;
    }>("/api/v1/notifications"),
  classifierSettings: () =>
    apiGet<{
      userId: string | null;
      settings: {
        mode: string;
        provider: string | null;
        modelId: string | null;
      };
      keysPresent: { anthropic: boolean; openai: boolean; ollamaUrl: boolean };
      egressDisclosure: string;
      classifierVersion: string;
      promptVersion: string;
    }>("/api/v1/settings/classifier"),
  updateClassifierSettings: (settings: {
    mode: "deterministic" | "local" | "api" | "hybrid";
    provider?: "anthropic" | "openai" | "ollama" | null;
    modelId?: string | null;
  }) =>
    apiSend<{
      settings: unknown;
      egressDisclosure: string;
      classifierVersion: string;
    }>("PATCH", "/api/v1/settings/classifier", { settings }),
  analyticsSites: () =>
    apiGet<{
      sites: Array<{
        id: string;
        siteKey: string;
        originAllowlist: string[];
        mode: string;
      }>;
      userId: string | null;
    }>("/api/v1/analytics/sites"),
  createAnalyticsSite: (body: {
    originAllowlist: string[];
    mode: "full" | "no_geo" | "off";
  }) =>
    apiSend<{ site: { id: string; siteKey: string; mode: string } }>(
      "POST",
      "/api/v1/analytics/sites",
      body,
    ),
  isDemo: demoEnabled,
};
