/**
 * L3 LLM extraction + arbitration helpers. AGENTS.md §13.1 / §13.5
 */
import {
  LlmExtractionV1Schema,
  type ExtractionV1,
  type LlmExtractionV1,
} from "@apptrack/shared";
import type { LlmClient } from "../llm/types.js";
import {
  buildExtractUserPrompt,
  EXTRACT_SYSTEM_PROMPT,
  PROMPT_VERSION,
} from "./prompts/extract.v1.js";
import { domainOfAddress } from "./ats/senders.js";

export { PROMPT_VERSION };

/** Confidence below which hybrid/api may invoke L3. AGENTS.md §13.1 */
export const L3_CONFIDENCE_THRESHOLD = 0.75;

export type L3Input = {
  subject?: string;
  textPlain?: string;
  fromAddress?: string;
  fromName?: string;
};

export type L3Result =
  | {
      ok: true;
      parsed: LlmExtractionV1;
      modelId: string;
      providerId: string;
      promptVersion: string;
      rawTruncated: string;
    }
  | {
      ok: false;
      reason: "schema_invalid" | "provider_error" | "empty";
      detail: string;
      modelId?: string;
      providerId?: string;
      promptVersion: string;
    };

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

/**
 * Call LLM with untrusted email block; validate against allowlist schema.
 * Invalid output → no-answer (never partially trusted). §13.5 / F6
 */
export async function runL3Extraction(llm: LlmClient, input: L3Input): Promise<L3Result> {
  const user = buildExtractUserPrompt({
    subject: input.subject,
    textPlain: input.textPlain,
    fromDisplay: input.fromName ?? input.fromAddress,
    fromDomain: domainOfAddress(input.fromAddress) ?? undefined,
  });

  let text: string;
  let modelId = llm.modelId;
  let providerId = llm.providerId;
  try {
    const out = await llm.completeJson({
      system: EXTRACT_SYSTEM_PROMPT,
      user,
      maxTokens: 1024,
    });
    text = out.text;
    modelId = out.modelId;
    providerId = out.providerId;
  } catch (err) {
    return {
      ok: false,
      reason: "provider_error",
      detail: (err as Error).message,
      modelId,
      providerId,
      promptVersion: PROMPT_VERSION,
    };
  }

  if (!text.trim()) {
    return {
      ok: false,
      reason: "empty",
      detail: "empty model output",
      modelId,
      providerId,
      promptVersion: PROMPT_VERSION,
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(stripJsonFences(text));
  } catch {
    return {
      ok: false,
      reason: "schema_invalid",
      detail: "model output was not JSON",
      modelId,
      providerId,
      promptVersion: PROMPT_VERSION,
    };
  }

  const parsed = LlmExtractionV1Schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "schema_invalid",
      detail: parsed.error.issues
        .map((i) => i.message)
        .join("; ")
        .slice(0, 200),
      modelId,
      providerId,
      promptVersion: PROMPT_VERSION,
    };
  }

  return {
    ok: true,
    parsed: parsed.data,
    modelId,
    providerId,
    promptVersion: PROMPT_VERSION,
    rawTruncated: text.slice(0, 500),
  };
}

export function llmToExtraction(llm: LlmExtractionV1): ExtractionV1 {
  return {
    company: llm.company,
    roleTitle: llm.roleTitle,
    applicationType: llm.applicationType,
    location: llm.location,
    workArrangement: llm.workArrangement,
    assessmentProvider: llm.assessmentProvider,
    assessmentDeadline: llm.assessmentDeadline,
    interviewDatetime: llm.interviewDatetime,
    interviewFormat: llm.interviewFormat,
    recruiterName: llm.recruiterName,
    recruiterEmail: llm.recruiterEmail,
    portalUrl: llm.portalUrl,
    jobPostingUrl: llm.jobPostingUrl,
    actionRequired: llm.actionRequired,
    confidence: llm.confidence,
  };
}

export function mergeExtraction(base: ExtractionV1, overlay: ExtractionV1): ExtractionV1 {
  const out: ExtractionV1 = { ...base };
  for (const [k, v] of Object.entries(overlay) as Array<
    [keyof ExtractionV1, ExtractionV1[keyof ExtractionV1]]
  >) {
    if (v === undefined || v === null || v === "") continue;
    const cur = out[k];
    if (cur === undefined || cur === null || cur === "") {
      (out as Record<string, unknown>)[k as string] = v;
    }
  }
  return out;
}

/**
 * Whether L3 should run given mode + deterministic confidence / extraction gaps.
 * // AGENTS.md §13.1
 */
export function shouldInvokeL3(opts: {
  mode: string;
  deterministicConfidence: number;
  extraction: ExtractionV1;
}): boolean {
  if (opts.mode === "deterministic") return false;
  if (opts.mode === "api" || opts.mode === "local") {
    // Always allow L3 in pure api/local when client provided; caller still gates on client.
    return (
      opts.deterministicConfidence < L3_CONFIDENCE_THRESHOLD ||
      extractionIncomplete(opts.extraction)
    );
  }
  if (opts.mode === "hybrid") {
    return (
      opts.deterministicConfidence < L3_CONFIDENCE_THRESHOLD ||
      extractionIncomplete(opts.extraction)
    );
  }
  return false;
}

export function extractionIncomplete(e: ExtractionV1): boolean {
  return !e.company && !e.roleTitle;
}

/**
 * Arbitration: deterministic beats LLM at equal confidence;
 * disagreement > 0.3 → needsReview. AGENTS.md §13.1
 */
export function arbitrate(
  det: { eventType: string; confidence: number },
  llm: { eventType?: string; confidence?: number } | null,
): {
  eventType: string;
  confidence: number;
  source: "deterministic" | "llm" | "deterministic_conflict";
  needsReview: boolean;
  disagreement: number;
} {
  if (!llm?.eventType) {
    return {
      eventType: det.eventType,
      confidence: det.confidence,
      source: "deterministic",
      needsReview: det.confidence < 0.6 || det.eventType === "unknown",
      disagreement: 0,
    };
  }
  const llmConf = llm.confidence ?? 0.5;
  const disagreement = Math.abs(det.confidence - llmConf);
  const sameType = det.eventType === llm.eventType;

  if (sameType) {
    return {
      eventType: det.eventType,
      confidence: Math.max(det.confidence, llmConf),
      source: det.confidence >= llmConf ? "deterministic" : "llm",
      needsReview: disagreement > 0.3 || Math.max(det.confidence, llmConf) < 0.6,
      disagreement,
    };
  }

  // Conflict on event type: deterministic wins at equal confidence
  if (det.confidence >= llmConf) {
    return {
      eventType: det.eventType,
      confidence: det.confidence,
      source: "deterministic_conflict",
      needsReview: true,
      disagreement: Math.max(disagreement, 0.31),
    };
  }
  return {
    eventType: llm.eventType,
    confidence: llmConf,
    source: "llm",
    needsReview: true,
    disagreement: Math.max(disagreement, 0.31),
  };
}
