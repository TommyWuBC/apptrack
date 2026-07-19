/**
 * Offline demo fixtures so the SPA is navigable without Postgres (M10 acceptance).
 */
import type {
  ApplicationRow,
  CompanyRow,
  EvidenceResponse,
  StatsResponse,
  TimelineResponse,
} from "./types.js";

let companies: CompanyRow[] = [
  {
    id: "co-initech",
    canonicalName: "Initech",
    primaryDomain: "initech.com",
    isStaffingAgency: false,
  },
  {
    id: "co-hooli",
    canonicalName: "Hooli",
    primaryDomain: "hooli.com",
    isStaffingAgency: false,
  },
  {
    id: "co-pied",
    canonicalName: "Pied Piper",
    primaryDomain: "piedpiper.com",
    isStaffingAgency: false,
  },
];

const applications: ApplicationRow[] = [
  {
    id: "app-1",
    userId: "user-demo",
    companyId: "co-initech",
    companyName: "Initech",
    roleId: "role-1",
    currentState: "interviewing",
    appliedAt: "2026-05-01T12:00:00.000Z",
    source: "greenhouse",
    lastEventAt: "2026-06-10T15:00:00.000Z",
    ghostStatus: "none",
    actionRequired: true,
    stateVersion: "state-v1",
  },
  {
    id: "app-2",
    userId: "user-demo",
    companyId: "co-hooli",
    companyName: "Hooli",
    roleId: "role-2",
    currentState: "assessment_received",
    appliedAt: "2026-05-20T12:00:00.000Z",
    source: "lever",
    lastEventAt: "2026-06-01T12:00:00.000Z",
    ghostStatus: "none",
    actionRequired: true,
    stateVersion: "state-v1",
  },
  {
    id: "app-3",
    userId: "user-demo",
    companyId: "co-pied",
    companyName: "Pied Piper",
    roleId: "role-3",
    currentState: "rejected",
    appliedAt: "2026-04-01T12:00:00.000Z",
    source: "email",
    lastEventAt: "2026-05-15T12:00:00.000Z",
    ghostStatus: "none",
    actionRequired: false,
    stateVersion: "state-v1",
  },
  {
    id: "app-4",
    userId: "user-demo",
    companyId: "co-initech",
    companyName: "Initech",
    roleId: "role-4",
    currentState: "confirmation_received",
    appliedAt: "2026-06-15T12:00:00.000Z",
    source: "greenhouse",
    lastEventAt: "2026-06-16T12:00:00.000Z",
    ghostStatus: "none",
    actionRequired: false,
    stateVersion: "state-v1",
  },
];

const timelines: Record<string, TimelineResponse> = {
  "app-1": {
    applicationId: "app-1",
    currentState: "interviewing",
    stateVersion: "state-v1",
    actionRequired: true,
    ghostStatus: "none",
    appliedAt: "2026-05-01T12:00:00.000Z",
    lastEventAt: "2026-06-10T15:00:00.000Z",
    reduce: {
      state: "interviewing",
      stateTimeline: [
        {
          state: "confirmation_received",
          at: "2026-05-01T12:00:00.000Z",
          eventId: "ev-1",
          eventType: "application_confirmation",
        },
        {
          state: "assessment_received",
          at: "2026-05-15T12:00:00.000Z",
          eventId: "ev-2",
          eventType: "oa_invitation",
        },
        {
          state: "interviewing",
          at: "2026-06-10T15:00:00.000Z",
          eventId: "ev-3",
          eventType: "interview_invitation",
        },
      ],
      actionRequired: true,
      flags: { conflict: false, reopened: false, onHold: false },
      reducerVersion: "state-v1",
    },
    events: [
      {
        id: "ev-1",
        eventType: "application_confirmation",
        occurredAt: "2026-05-01T12:00:00.000Z",
        ingestedAt: "2026-05-01T12:05:00.000Z",
        source: "email",
        messageId: "msg-1",
        classificationResultId: "clf-1",
        payload: { extraction: { company: "Initech", roleTitle: "SWE Intern" } },
        supersededBy: null,
      },
      {
        id: "ev-2",
        eventType: "oa_invitation",
        occurredAt: "2026-05-15T12:00:00.000Z",
        ingestedAt: "2026-05-15T12:05:00.000Z",
        source: "email",
        messageId: "msg-2",
        classificationResultId: "clf-2",
        payload: {
          extraction: { assessmentProvider: "HackerRank" },
        },
        supersededBy: null,
      },
      {
        id: "ev-3",
        eventType: "interview_invitation",
        occurredAt: "2026-06-10T15:00:00.000Z",
        ingestedAt: "2026-06-10T15:05:00.000Z",
        source: "email",
        messageId: "msg-3",
        classificationResultId: "clf-3",
        payload: {},
        supersededBy: null,
      },
    ],
  },
};

const evidence: Record<string, EvidenceResponse> = {
  "msg-1": {
    messageId: "msg-1",
    subject: "Thanks for applying to Initech",
    fromAddress: "noreply@greenhouse.io",
    fromName: "Initech Recruiting",
    internalDate: "2026-05-01T12:00:00.000Z",
    sanitizedHtml:
      "<p>Thanks for applying to the <strong>SWE Intern</strong> role at Initech.</p>",
    textPlain: "Thanks for applying to the SWE Intern role at Initech.",
    classification: {
      eventType: "application_confirmation",
      confidence: 0.95,
      evidence: [
        {
          kind: "ats_template",
          detail: "Matched Greenhouse application-confirmation template",
        },
      ],
      needsReview: false,
      extraction: { company: "Initech", roleTitle: "SWE Intern" },
      layerTrace: [{ layer: "L1", platform: "greenhouse" }],
    },
    matchCandidates: [
      {
        id: "mc-1",
        applicationId: "app-1",
        score: 0.9,
        decision: "new_application",
        signals: [{ name: "requisitionOrUrl", fired: false }],
        matcherVersion: "match-v1",
      },
    ],
  },
};

let reviewItems = [
  {
    id: "rev-1",
    kind: "ambiguous_match",
    refId: "msg-demo-amb",
    status: "open",
    resolution: {
      companyId: "co-initech",
      match: {
        decision: "review",
        score: 0.6,
        reason: "Two SWE roles at Initech",
        candidates: [
          { applicationId: "app-1", score: 0.6 },
          { applicationId: "app-4", score: 0.55 },
        ],
      },
    },
  },
  {
    id: "rev-2",
    kind: "entity_merge_suggestion",
    refId: "co-pied",
    status: "open",
    resolution: {
      suggestedCompanyId: "co-initech",
      suggestedCanonicalName: "Initech",
      similarity: 0.87,
      candidateName: "Initechh",
    },
  },
];

const correctionsStore: Array<{
  id: string;
  field: string;
  machineValue: unknown;
  userValue: unknown;
  locked: boolean;
  revertedAt: string | null;
  createdAt: string;
}> = [
  {
    id: "corr-demo-1",
    field: "currentState",
    machineValue: "interviewing",
    userValue: "final_round",
    locked: true,
    revertedAt: null,
    createdAt: "2026-06-11T12:00:00.000Z",
  },
];

function rate(
  numerator: number,
  denominator: number,
  label: string,
): StatsResponse["rates"][string] {
  const smallSample = denominator < 10;
  return {
    smallSample,
    numerator,
    denominator,
    rate: smallSample ? null : numerator / denominator,
    label,
  };
}

const stats: StatsResponse = {
  totals: { applications: 4, actionRequired: 2, companies: 3 },
  byState: {
    interviewing: 1,
    assessment_received: 1,
    rejected: 1,
    confirmation_received: 1,
  },
  applicationsThisWeek: 1,
  rates: {
    response: rate(3, 4, "Response rate"),
    rejection: rate(1, 4, "Rejection rate"),
    offer: rate(0, 4, "Offer rate"),
    ghost: rate(0, 4, "Ghost rate"),
    oaToInterview: rate(1, 2, "OA→interview"),
    interviewToOffer: rate(0, 1, "Interview→offer"),
  },
  ratesFormatted: {
    response: "3/4",
    rejection: "1/4",
    offer: "0/4",
    ghost: "0/4",
    oaToInterview: "1/2",
    interviewToOffer: "0/1",
  },
  mediansDays: { timeToFirstResponse: 12, timeBetweenStages: 6 },
  topCompaniesByActivity: [
    { companyId: "co-initech", name: "Initech", count: 2 },
    { companyId: "co-hooli", name: "Hooli", count: 1 },
    { companyId: "co-pied", name: "Pied Piper", count: 1 },
  ],
  sourceCounts: { greenhouse: 2, lever: 1, email: 1 },
  smallSampleThreshold: 10,
};

function pathOnly(path: string): string {
  return path.split("?")[0] ?? path;
}

export const demoStore = {
  get(path: string): unknown {
    const p = pathOnly(path);
    if (p === "/api/v1/me") {
      return { userId: "user-demo", setupRequired: false };
    }
    if (p === "/api/v1/applications") {
      return { applications, userId: "user-demo" };
    }
    if (p === "/api/v1/companies") {
      return { companies };
    }
    if (p === "/api/v1/stats") {
      return stats;
    }
    if (p === "/api/v1/review") {
      return { items: reviewItems };
    }
    const corrMatch = p.match(/^\/api\/v1\/applications\/([^/]+)\/corrections$/);
    if (corrMatch) {
      return {
        applicationId: corrMatch[1],
        corrections: correctionsStore.filter((c) => !c.revertedAt || true),
      };
    }
    const appMatch = p.match(/^\/api\/v1\/applications\/([^/]+)$/);
    if (appMatch) {
      const id = appMatch[1]!;
      const application = applications.find((a) => a.id === id);
      if (!application) throw new Error("API 404: application_not_found");
      const company = companies.find((c) => c.id === application.companyId) ?? null;
      return { application, company, reducerVersion: "state-v1" };
    }
    const tlMatch = p.match(/^\/api\/v1\/applications\/([^/]+)\/timeline$/);
    if (tlMatch) {
      const id = tlMatch[1]!;
      const tl = timelines[id];
      if (tl) {
        return {
          ...tl,
          currentState: "final_round", // demo lock overlays interviewing
          corrections: correctionsStore,
        };
      }
      // Minimal timeline for apps without a rich fixture
      const application = applications.find((a) => a.id === id);
      if (!application) throw new Error("API 404: application_not_found");
      return {
        applicationId: id,
        currentState: application.currentState,
        stateVersion: "state-v1",
        actionRequired: application.actionRequired,
        ghostStatus: application.ghostStatus,
        appliedAt: application.appliedAt,
        lastEventAt: application.lastEventAt,
        reduce: {
          state: application.currentState,
          stateTimeline: [],
          actionRequired: application.actionRequired,
          flags: { conflict: false, reopened: false, onHold: false },
          reducerVersion: "state-v1",
        },
        events: [],
      } satisfies TimelineResponse;
    }
    const evMatch = p.match(/^\/api\/v1\/emails\/([^/]+)\/evidence$/);
    if (evMatch) {
      const id = evMatch[1]!;
      const e = evidence[id];
      if (!e) throw new Error("API 404: message_not_found");
      return e;
    }
    throw new Error(`Demo fixture missing for ${path}`);
  },

  mutate(method: string, path: string, body?: unknown): unknown {
    const p = pathOnly(path);
    if (method === "POST" && p === "/api/v1/review/rev-1/resolve") {
      reviewItems = reviewItems.filter((r) => r.id !== "rev-1");
      return { reviewId: "rev-1", status: "resolved", detail: body };
    }
    if (method === "POST" && /^\/api\/v1\/review\/[^/]+\/resolve$/.test(p)) {
      const id = p.split("/")[4]!;
      reviewItems = reviewItems.filter((r) => r.id !== id);
      return { reviewId: id, status: "resolved", detail: body };
    }
    if (method === "PATCH" && /^\/api\/v1\/applications\/[^/]+$/.test(p)) {
      const id = p.split("/")[4]!;
      const fields =
        (body as { fields?: Array<{ field: string; userValue: unknown; locked?: boolean }> })
          ?.fields ?? [];
      for (const f of fields) {
        correctionsStore.push({
          id: `corr-${correctionsStore.length + 1}`,
          field: f.field,
          machineValue: null,
          userValue: f.userValue,
          locked: f.locked ?? false,
          revertedAt: null,
          createdAt: new Date().toISOString(),
        });
        const app = applications.find((a) => a.id === id);
        if (app && f.field === "currentState" && typeof f.userValue === "string") {
          app.currentState = f.userValue;
        }
      }
      return {
        correctionIds: correctionsStore.slice(-fields.length).map((c) => c.id),
        recomputed: { applicationId: id, state: applications.find((a) => a.id === id)?.currentState },
      };
    }
    if (method === "POST" && /^\/api\/v1\/corrections\/[^/]+\/undo$/.test(p)) {
      const id = p.split("/")[4]!;
      const c = correctionsStore.find((x) => x.id === id);
      if (c) c.revertedAt = new Date().toISOString();
      return { correction: c, alreadyReverted: false };
    }
    if (method === "POST" && p === "/api/v1/companies/merge") {
      const b = body as { survivorCompanyId: string; sourceCompanyId: string };
      companies = companies.filter((c) => c.id !== b.sourceCompanyId);
      return b;
    }
    if (method === "POST" && /\/merge$/.test(p)) {
      return { survivorId: p.split("/")[4], sourceIds: (body as { sourceIds: string[] }).sourceIds, movedEventIds: [] };
    }
    if (method === "POST" && /\/split$/.test(p)) {
      return {
        sourceApplicationId: p.split("/")[4],
        newApplicationId: "app-split",
        moved: (body as { eventIds: string[] }).eventIds,
      };
    }
    if (method === "POST" && /\/reattach$/.test(p)) {
      return {
        priorEventId: p.split("/")[6],
        newEventId: "ev-new",
        toApplicationId: (body as { toApplicationId: string }).toApplicationId,
      };
    }
    throw new Error(`Demo mutate missing for ${method} ${path}`);
  },
};
