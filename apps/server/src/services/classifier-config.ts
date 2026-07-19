/**
 * Resolve CLASSIFIER_MODE + optional LLM client from env / settings.
 * AGENTS.md §13.2 — deterministic works with zero keys (NFR-6).
 */
import {
  ClassifierMode,
  ClassifierSettingsV1Schema,
  type ClassifierSettingsV1,
} from "@apptrack/shared";
import {
  createLlmClient,
  type LlmClient,
  type LlmProviderId,
} from "@apptrack/core";

export type ResolvedClassifierConfig = {
  mode: ClassifierSettingsV1["mode"];
  provider: LlmProviderId | null;
  modelId: string | null;
  llm: LlmClient | null;
  /** Human-readable egress disclosure for settings UI */
  egressDisclosure: string;
};

const EGRESS: Record<string, string> = {
  deterministic:
    "No email content leaves this machine. Classification uses local rules only.",
  local:
    "Subject + stripped plain text (≤4,000 chars) + sender display/domain are sent to your local Ollama endpoint only. No cloud provider.",
  api_anthropic:
    "Subject + stripped plain text (≤4,000 chars) + sender display/domain are sent to Anthropic (api.anthropic.com). No full headers, attachments, or other emails.",
  api_openai:
    "Subject + stripped plain text (≤4,000 chars) + sender display/domain are sent to OpenAI (api.openai.com). No full headers, attachments, or other emails.",
  hybrid:
    "Deterministic rules run first. Only low-confidence or incomplete extractions emails may send subject + stripped plain text (≤4,000 chars) + sender to the configured provider.",
};

export function resolveClassifierConfig(
  settings?: Partial<ClassifierSettingsV1> | null,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedClassifierConfig {
  const envMode = (env.CLASSIFIER_MODE ?? "deterministic").toLowerCase();
  const parsed = ClassifierSettingsV1Schema.parse({
    mode:
      settings?.mode ??
      (envMode === "local" ||
      envMode === "api" ||
      envMode === "hybrid" ||
      envMode === "deterministic"
        ? envMode
        : "deterministic"),
    provider: settings?.provider ?? null,
    modelId: settings?.modelId ?? null,
  });

  let provider = parsed.provider as LlmProviderId | null;
  if (!provider && (parsed.mode === "api" || parsed.mode === "hybrid")) {
    if (env.ANTHROPIC_API_KEY) provider = "anthropic";
    else if (env.OPENAI_API_KEY) provider = "openai";
  }
  if (!provider && parsed.mode === "local") {
    provider = "ollama";
  }

  let llm: LlmClient | null = null;
  if (
    parsed.mode !== ClassifierMode.deterministic &&
    provider
  ) {
    try {
      llm = createLlmClient({
        provider,
        apiKey:
          provider === "anthropic"
            ? env.ANTHROPIC_API_KEY
            : provider === "openai"
              ? env.OPENAI_API_KEY
              : undefined,
        baseUrl: provider === "ollama" ? env.OLLAMA_URL || undefined : undefined,
        modelId: parsed.modelId ?? undefined,
      });
    } catch {
      llm = null;
    }
  }

  let egressKey: string = parsed.mode;
  if (parsed.mode === "api" || parsed.mode === "hybrid") {
    if (provider === "anthropic") egressKey = "api_anthropic";
    else if (provider === "openai") egressKey = "api_openai";
    else if (parsed.mode === "hybrid") egressKey = "hybrid";
  }
  if (parsed.mode === "local") egressKey = "local";
  if (parsed.mode === "deterministic") egressKey = "deterministic";

  return {
    mode: parsed.mode,
    provider,
    modelId: parsed.modelId ?? llm?.modelId ?? null,
    llm,
    egressDisclosure:
      EGRESS[egressKey] ??
      EGRESS.deterministic!,
  };
}
