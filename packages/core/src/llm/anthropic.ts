/**
 * Anthropic Messages API adapter (HTTP). AGENTS.md §13.2
 * Uses official REST shape; no SDK required (see DEVLOG R-6).
 */
import type {
  CreateLlmClientOptions,
  LlmClient,
  LlmCompleteInput,
  LlmCompleteResult,
} from "./types.js";

const DEFAULT_MODEL = "claude-3-5-haiku-latest";

export function createAnthropicClient(opts: CreateLlmClientOptions): LlmClient {
  const apiKey = opts.apiKey ?? "";
  const modelId = opts.modelId ?? DEFAULT_MODEL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = (opts.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");

  return {
    providerId: "anthropic",
    modelId,
    async completeJson(input: LlmCompleteInput): Promise<LlmCompleteResult> {
      if (!apiKey) throw new Error("anthropic_api_key_missing");
      const res = await fetchImpl(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: input.maxTokens ?? 1024,
          system: input.system,
          messages: [{ role: "user", content: input.user }],
        }),
      });
      if (!res.ok) {
        throw new Error(`anthropic_http_${res.status}`);
      }
      const body = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text =
        body.content
          ?.filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join("") ?? "";
      return { text, modelId, providerId: "anthropic" };
    },
  };
}
