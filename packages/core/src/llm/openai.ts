/**
 * OpenAI Chat Completions adapter (HTTP). AGENTS.md §13.2
 */
import type {
  CreateLlmClientOptions,
  LlmClient,
  LlmCompleteInput,
  LlmCompleteResult,
} from "./types.js";

const DEFAULT_MODEL = "gpt-4o-mini";

export function createOpenAiClient(opts: CreateLlmClientOptions): LlmClient {
  const apiKey = opts.apiKey ?? "";
  const modelId = opts.modelId ?? DEFAULT_MODEL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = (opts.baseUrl ?? "https://api.openai.com").replace(/\/$/, "");

  return {
    providerId: "openai",
    modelId,
    async completeJson(input: LlmCompleteInput): Promise<LlmCompleteResult> {
      if (!apiKey) throw new Error("openai_api_key_missing");
      const res = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: input.maxTokens ?? 1024,
          // T8: opt out of provider retention where supported
          store: false,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`openai_http_${res.status}`);
      }
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content ?? "";
      return { text, modelId, providerId: "openai" };
    },
  };
}
