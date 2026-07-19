/**
 * Layered classification pipeline (L0–L3). AGENTS.md §13
 * Deterministic-first; LLM optional and mode-gated (NFR-6).
 */
import {
  ClassificationResultV1Schema,
  ClassifierMode,
  EventType,
  type ClassificationResultV1,
  type EvidenceItem,
  type ExtractionV1,
} from "@apptrack/shared";
import { detectAtsPlatform } from "./ats/detect.js";
import { detectAtsTemplate } from "./ats/templates.js";
import { extractFields } from "./extract.js";
import { RULES } from "./rules/families.js";
import {
  CLASSIFIER_VERSION,
  RULES_VERSION,
  PROMPT_VERSION,
} from "./version.js";
import { isAtsSenderDomain, domainOfAddress } from "./ats/senders.js";
import type { LlmClient } from "../llm/types.js";
import {
  arbitrate,
  llmToExtraction,
  mergeExtraction,
  runL3Extraction,
  shouldInvokeL3,
} from "./l3.js";

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

export type ClassifyOptions = {
  mode?: (typeof ClassifierMode)[keyof typeof ClassifierMode];
  /** Required for local/api/hybrid when L3 would run */
  llm?: LlmClient | null;
};

function haystack(input: ClassifyInput): string {
  return [input.subject ?? "", input.textPlain ?? "", input.textFull ?? ""]
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

function runDeterministic(input: ClassifyInput): {
  result: ClassificationResultV1;
  candidates: Candidate[];
  text: string;
  ats: string | null;
} {
  const hay = haystack(input);
  const text = input.textPlain || input.textFull || "";
  const evidence: EvidenceItem[] = [];
  const layerTrace: Array<Record<string, unknown>> = [];
  const candidates: Candidate[] = [];

  // Prompt-injection canaries → unknown on merits (T6)
  if (
    /ignore previous instructions/i.test(hay) ||
    /new system prompt/i.test(hay) ||
    /exfiltrate/i.test(hay)
  ) {
    layerTrace.push({ layer: "guard", action: "injection_canary" });
    const result = ClassificationResultV1Schema.parse({
      eventType: EventType.unknown,
      isJobRelated: false,
      confidence: 0.2,
      evidence: [
        {
          kind: "keyword_rule",
          detail:
            "Prompt-injection canary phrasing — classified on merits as unknown",
        },
      ],
      extraction: {},
      needsReview: true,
      layerTrace,
    });
    return { result, candidates, text, ats: null };
  }

  const ats = detectAtsPlatform(input.fromAddress, text);
  if (ats) {
    evidence.push({
      kind: "sender_domain",
      detail: `ATS/recruiting platform signal: ${ats}`,
    });
    layerTrace.push({ layer: "L1", ats });
  }

  const atsTemplate = detectAtsTemplate({
    fromAddress: input.fromAddress,
    subject: input.subject,
    text,
  });
  if (atsTemplate) {
    candidates.push({
      eventType: atsTemplate.eventType,
      confidence: atsTemplate.confidence,
      evidence: {
        kind: "ats_template",
        detail: atsTemplate.detail,
      },
      layer: "L1-template",
    });
    layerTrace.push({
      layer: "L1",
      ats: atsTemplate.platform,
      eventType: atsTemplate.eventType,
    });
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

  for (const rule of RULES) {
    if (matchesRule(hay, rule.patterns, rule.antiPatterns)) {
      if (rule.id === "R-OA-REM-1") {
        const ok =
          (hay.includes("reminder") || hay.includes("due soon")) &&
          hay.includes("assessment");
        if (!ok) continue;
      }
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
      layerTrace.push({
        layer: "L2",
        ruleId: rule.id,
        eventType: rule.eventType,
      });
    }
  }

  const subject = (input.subject ?? "").toLowerCase();
  const subjectHints: Array<{
    needle: string;
    eventType: EventType;
    conf: number;
  }> = [
    {
      needle: "application received",
      eventType: EventType.application_confirmation,
      conf: 0.9,
    },
    {
      needle: "online assessment invitation",
      eventType: EventType.oa_invitation,
      conf: 0.9,
    },
    {
      needle: "interview invitation",
      eventType: EventType.interview_invitation,
      conf: 0.9,
    },
    {
      needle: "interview confirmed",
      eventType: EventType.interview_scheduled,
      conf: 0.9,
    },
    {
      needle: "interview rescheduled",
      eventType: EventType.interview_rescheduled,
      conf: 0.92,
    },
    {
      needle: "interview cancelled",
      eventType: EventType.interview_cancelled,
      conf: 0.92,
    },
    { needle: "offer from", eventType: EventType.offer, conf: 0.9 },
    {
      needle: "careers weekly",
      eventType: EventType.newsletter_ignore,
      conf: 0.88,
    },
    {
      needle: "duplicate application",
      eventType: EventType.duplicate_application_notice,
      conf: 0.9,
    },
    {
      needle: "withdrawal confirmed",
      eventType: EventType.withdrawal_confirmation,
      conf: 0.9,
    },
    {
      needle: "follow-up requested",
      eventType: EventType.followup_request,
      conf: 0.88,
    },
    {
      needle: "additional information needed",
      eventType: EventType.info_request,
      conf: 0.88,
    },
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

  const extraction = extractFields({
    subject: input.subject,
    text,
    atsPlatform: ats,
    links: input.links,
  });

  if (!best) {
    const vague =
      /candidacy|application|recruiting|interview|assessment/i.test(hay);
    const result = ClassificationResultV1Schema.parse({
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
      extraction,
      needsReview: true,
      layerTrace,
    });
    return { result, candidates, text, ats };
  }

  const allEvidence = [...evidence, best.evidence];
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

  const result = ClassificationResultV1Schema.parse({
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
  return { result, candidates, text, ats };
}

/**
 * Classify an email. Deterministic always runs; L3 is mode-gated.
 * // AGENTS.md §13
 */
export async function classifyEmail(
  input: ClassifyInput,
  opts: ClassifyOptions = {},
): Promise<ClassificationResultV1> {
  const mode = opts.mode ?? ClassifierMode.deterministic;
  const { result: det, text } = runDeterministic(input);

  // Injection canaries never escalate to LLM (T6)
  const guarded = det.layerTrace?.some(
    (t) => t.action === "injection_canary",
  );
  if (guarded) return det;

  const invoke =
    opts.llm &&
    shouldInvokeL3({
      mode,
      deterministicConfidence: det.confidence,
      extraction: det.extraction,
    });

  if (!invoke || !opts.llm) {
    return ClassificationResultV1Schema.parse({
      ...det,
      layerTrace: [
        ...(det.layerTrace ?? []),
        { layer: "L3", skipped: true, mode },
      ],
    });
  }

  const l3 = await runL3Extraction(opts.llm, {
    subject: input.subject,
    textPlain: text.slice(0, 4000),
    fromAddress: input.fromAddress,
    fromName: input.fromName,
  });

  if (!l3.ok) {
    return ClassificationResultV1Schema.parse({
      ...det,
      needsReview: true,
      evidence: [
        ...det.evidence,
        {
          kind: "llm",
          detail: `L3 ${l3.reason}: ${l3.detail}`.slice(0, 200),
        },
      ],
      layerTrace: [
        ...(det.layerTrace ?? []),
        {
          layer: "L3",
          ok: false,
          reason: l3.reason,
          promptVersion: PROMPT_VERSION,
          modelId: l3.modelId,
          providerId: l3.providerId,
        },
      ],
    });
  }

  const arb = arbitrate(
    { eventType: det.eventType, confidence: det.confidence },
    {
      eventType: l3.parsed.eventType,
      confidence: l3.parsed.confidence,
    },
  );

  const llmExtraction = llmToExtraction(l3.parsed);
  let extraction: ExtractionV1 =
    arb.source === "llm" || arb.source === "deterministic_conflict"
      ? mergeExtraction(det.extraction, llmExtraction)
      : mergeExtraction(llmExtraction, det.extraction);
  // Prefer filling gaps from LLM always
  extraction = mergeExtraction(det.extraction, llmExtraction);

  const evidence: EvidenceItem[] = [
    ...det.evidence,
    {
      kind: "llm",
      detail: l3.parsed.justification.slice(0, 200),
    },
  ];

  const eventType = arb.eventType;
  const isJobRelated =
    eventType !== EventType.newsletter_ignore &&
    (l3.parsed.isJobRelated ?? eventType !== EventType.unknown);

  return ClassificationResultV1Schema.parse({
    eventType,
    isJobRelated,
    confidence: arb.confidence,
    evidence,
    extraction,
    needsReview:
      arb.needsReview ||
      eventType === EventType.unknown ||
      arb.confidence < 0.6,
    layerTrace: [
      ...(det.layerTrace ?? []),
      {
        layer: "L3",
        ok: true,
        promptVersion: PROMPT_VERSION,
        modelId: l3.modelId,
        providerId: l3.providerId,
        arbitration: arb,
      },
    ],
  });
}

export { CLASSIFIER_VERSION, RULES_VERSION, PROMPT_VERSION } from "./version.js";
export {
  L3_CONFIDENCE_THRESHOLD,
  shouldInvokeL3,
  arbitrate,
  runL3Extraction,
} from "./l3.js";
