/**
 * Deterministic classification pipeline (L1 + L2). AGENTS.md §13
 * Mode: deterministic only in M7 — L3 deferred.
 */
import {
  ClassificationResultV1Schema,
  EventType,
  type ClassificationResultV1,
  type EvidenceItem,
} from "@apptrack/shared";
import { detectAtsPlatform } from "./ats/detect.js";
import { extractFields } from "./extract.js";
import { RULES } from "./rules/families.js";
import { CLASSIFIER_VERSION, RULES_VERSION } from "./version.js";
import { isAtsSenderDomain, domainOfAddress } from "./ats/senders.js";

export type ClassifyInput = {
  subject?: string;
  textPlain?: string;
  textFull?: string;
  fromAddress?: string;
  fromName?: string;
  headers?: Record<string, string>;
  links?: Array<{ url: string; isTracking?: boolean }>;
  calendarEvent?: { summary?: string; start?: string } | null;
};

function haystack(input: ClassifyInput): string {
  return [
    input.subject ?? "",
    input.textPlain ?? "",
    input.textFull ?? "",
  ]
    .join("\n")
    .toLowerCase();
}

function matchesRule(
  hay: string,
  patterns: string[],
  anti: string[] = [],
): boolean {
  if (anti.some((a) => hay.includes(a.toLowerCase()))) return false;
  return patterns.some((p) => hay.includes(p.toLowerCase()));
}

type Candidate = {
  eventType: EventType;
  confidence: number;
  evidence: EvidenceItem;
  layer: string;
};

export function classifyEmail(input: ClassifyInput): ClassificationResultV1 {
  const hay = haystack(input);
  const text = input.textPlain || input.textFull || "";
  const evidence: EvidenceItem[] = [];
  const layerTrace: Array<Record<string, unknown>> = [];
  const candidates: Candidate[] = [];

  // Prompt-injection canaries → unknown on merits (T6 / fixture notes)
  if (
    /ignore previous instructions/i.test(hay) ||
    /new system prompt/i.test(hay) ||
    /exfiltrate/i.test(hay)
  ) {
    layerTrace.push({ layer: "guard", action: "injection_canary" });
    return ClassificationResultV1Schema.parse({
      eventType: EventType.unknown,
      isJobRelated: false,
      confidence: 0.2,
      evidence: [
        {
          kind: "keyword_rule",
          detail: "Prompt-injection canary phrasing — classified on merits as unknown",
        },
      ],
      extraction: {},
      needsReview: true,
      layerTrace,
    });
  }

  const ats = detectAtsPlatform(input.fromAddress, text);
  if (ats) {
    evidence.push({
      kind: "sender_domain",
      detail: `ATS/recruiting platform signal: ${ats}`,
    });
    layerTrace.push({ layer: "L1", ats });
  }

  const listId =
    input.headers?.["List-Id"] ?? input.headers?.["list-id"] ?? "";
  if (
    listId &&
    (input.headers?.["List-Unsubscribe"] ||
      input.headers?.["list-unsubscribe"]) &&
    !isAtsSenderDomain(domainOfAddress(input.fromAddress))
  ) {
    candidates.push({
      eventType: EventType.newsletter_ignore,
      confidence: 0.85,
      evidence: {
        kind: "sender_domain",
        detail: "List-Id newsletter headers",
      },
      layer: "L0",
    });
  }

  // Calendar strongly suggests interview_scheduled
  if (input.calendarEvent?.summary || input.calendarEvent?.start) {
    candidates.push({
      eventType: EventType.interview_scheduled,
      confidence: 0.95,
      evidence: {
        kind: "calendar",
        detail: "Calendar invite attached or embedded",
      },
      layer: "L1-calendar",
    });
  }

  // L2 rules — prefer higher weight; first matching family in RULES order
  // but collect all and pick best confidence
  for (const rule of RULES) {
    if (matchesRule(hay, rule.patterns, rule.antiPatterns)) {
      // OA reminder needs both reminder-ish and assessment
      if (rule.id === "R-OA-REM-1") {
        const ok =
          (hay.includes("reminder") || hay.includes("due soon")) &&
          hay.includes("assessment");
        if (!ok) continue;
      }
      // Interview scheduled: avoid matching plain "your interview for" on invite
      if (rule.id === "R-INT-SCHED-1") {
        const ok =
          hay.includes("confirmed") ||
          hay.includes("is confirmed") ||
          (hay.includes("your interview for") &&
            /\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}/.test(hay));
        if (!ok) continue;
      }
      candidates.push({
        eventType: rule.eventType,
        confidence: rule.weight + (ats ? 0.03 : 0),
        evidence: {
          kind: "keyword_rule",
          detail: rule.evidenceTemplate,
        },
        layer: "L2",
      });
      layerTrace.push({ layer: "L2", ruleId: rule.id, eventType: rule.eventType });
    }
  }

  // Subject-line helpers for ATS templates
  const subject = (input.subject ?? "").toLowerCase();
  const subjectHints: Array<{ needle: string; eventType: EventType; conf: number }> = [
    { needle: "application received", eventType: EventType.application_confirmation, conf: 0.9 },
    { needle: "online assessment invitation", eventType: EventType.oa_invitation, conf: 0.9 },
    { needle: "interview invitation", eventType: EventType.interview_invitation, conf: 0.9 },
    { needle: "interview confirmed", eventType: EventType.interview_scheduled, conf: 0.9 },
    { needle: "interview rescheduled", eventType: EventType.interview_rescheduled, conf: 0.92 },
    { needle: "interview cancelled", eventType: EventType.interview_cancelled, conf: 0.92 },
    { needle: "offer from", eventType: EventType.offer, conf: 0.9 },
    { needle: "careers weekly", eventType: EventType.newsletter_ignore, conf: 0.88 },
    { needle: "duplicate application", eventType: EventType.duplicate_application_notice, conf: 0.9 },
    { needle: "withdrawal confirmed", eventType: EventType.withdrawal_confirmation, conf: 0.9 },
    { needle: "follow-up requested", eventType: EventType.followup_request, conf: 0.88 },
    { needle: "additional information needed", eventType: EventType.info_request, conf: 0.88 },
  ];
  for (const h of subjectHints) {
    if (subject.includes(h.needle)) {
      candidates.push({
        eventType: h.eventType,
        confidence: h.conf,
        evidence: {
          kind: "ats_template",
          detail: `Subject matches ${h.eventType} template`,
        },
        layer: "L1-subject",
      });
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];

  if (!best) {
    const vague =
      /candidacy|application|recruiting|interview|assessment/i.test(hay);
    return ClassificationResultV1Schema.parse({
      eventType: EventType.unknown,
      isJobRelated: vague,
      confidence: 0.25,
      evidence: evidence.length
        ? evidence
        : [
            {
              kind: "keyword_rule",
              detail: "No deterministic rule matched",
            },
          ],
      extraction: extractFields({
        subject: input.subject,
        text,
        atsPlatform: ats,
        links: input.links,
      }),
      needsReview: true,
      layerTrace,
    });
  }

  const allEvidence = [...evidence, best.evidence];
  // Prefer ats_template evidence label when ATS + high conf
  if (ats && best.confidence >= 0.9) {
    allEvidence.push({
      kind: "ats_template",
      detail: `Matched ${ats} recruiting template for ${best.eventType}`,
    });
  }

  const confidence = Math.min(1, best.confidence);
  const eventType = best.eventType;
  const isJobRelated = eventType !== EventType.newsletter_ignore;
  const needsReview =
    confidence < 0.6 || eventType === EventType.unknown;

  const extraction = extractFields({
    subject: input.subject,
    text,
    atsPlatform: ats,
    links: input.links,
  });

  return ClassificationResultV1Schema.parse({
    eventType,
    isJobRelated,
    confidence,
    evidence: allEvidence,
    extraction,
    needsReview,
    layerTrace: [
      ...layerTrace,
      {
        layer: "winner",
        eventType,
        confidence,
        classifierVersion: CLASSIFIER_VERSION,
        rulesVersion: RULES_VERSION,
      },
    ],
  });
}

export { CLASSIFIER_VERSION, RULES_VERSION } from "./version.js";
