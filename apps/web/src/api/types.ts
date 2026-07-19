/** Shared API DTO types for the SPA client + demo fixtures. */

export type ApplicationRow = {
  id: string;
  userId: string;
  companyId: string;
  companyName: string;
  roleId: string | null;
  currentState: string;
  appliedAt: string | null;
  source: string | null;
  lastEventAt: string | null;
  ghostStatus: string;
  actionRequired: boolean;
  stateVersion: string | null;
  updatedAt?: string;
};

export type TimelineEvent = {
  id: string;
  eventType: string;
  occurredAt: string;
  ingestedAt: string;
  source: string;
  messageId: string | null;
  classificationResultId: string | null;
  payload: unknown;
  supersededBy: string | null;
};

export type TimelineResponse = {
  applicationId: string;
  currentState: string;
  stateVersion: string | null;
  actionRequired: boolean;
  ghostStatus: string;
  appliedAt: string | null;
  lastEventAt: string | null;
  reduce: {
    state: string;
    stateTimeline: Array<{
      state: string;
      at: string;
      eventId: string;
      eventType: string;
    }>;
    actionRequired: boolean;
    flags: { conflict: boolean; reopened: boolean; onHold: boolean };
    reducerVersion: string;
  };
  corrections?: Array<{
    id: string;
    field: string;
    machineValue: unknown;
    userValue: unknown;
    locked: boolean;
    revertedAt: string | null;
    createdAt: string;
  }>;
  events: TimelineEvent[];
};

export type RateStat = {
  smallSample: boolean;
  numerator: number;
  denominator: number;
  rate: number | null;
  label: string;
};

export type StatsResponse = {
  totals: { applications: number; actionRequired: number; companies: number };
  byState: Record<string, number>;
  applicationsThisWeek: number;
  rates: Record<string, RateStat>;
  ratesFormatted: Record<string, string>;
  mediansDays: {
    timeToFirstResponse: number | null;
    timeBetweenStages: number | null;
  };
  topCompaniesByActivity: Array<{
    companyId: string;
    name: string;
    count: number;
  }>;
  sourceCounts: Record<string, number>;
  smallSampleThreshold: number;
};

export type EvidenceResponse = {
  messageId: string;
  subject: string | null;
  fromAddress: string | null;
  fromName: string | null;
  internalDate: string;
  sanitizedHtml: string | null;
  textPlain: string | null;
  classification: {
    eventType: string;
    confidence: number;
    evidence: Array<{ kind: string; detail: string }>;
    needsReview: boolean;
    extraction: unknown;
    layerTrace: unknown;
  } | null;
  matchCandidates: Array<{
    id: string;
    applicationId: string | null;
    score: number;
    decision: string;
    signals: unknown;
    matcherVersion: string;
  }>;
};

export type CompanyRow = {
  id: string;
  canonicalName: string;
  primaryDomain: string | null;
  isStaffingAgency: boolean;
};
