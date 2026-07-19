/**
 * Ollama local HTTP adapter. AGENTS.md §13.2 (`local` mode)
 */
import type {
  CreateLlmClientOptions,
  LlmClient,
  LlmCompleteInput,
  LlmCompleteResult,
} from "./types.js";

const DEFAULT_MODEL = "llama3.2";

export function createOllamaClient(opts: CreateLlmClientOptions): LlmClient {
  const modelId = opts.modelId ?? DEFAULT_MODEL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = (opts.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");

  return {
    providerId: "ollama",
    modelId,
    async completeJson(input: LlmCompleteInput): Promise<LlmCompleteResult> {
      const res = await fetchImpl(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
          options: { num_predict: input.maxTokens ?? 1024 },
        }),
      });
      if (!res.ok) {
        throw new Error(`ollama_http_${res.status}`);
      }
      const body = (await res.json()) as {
        message?: { content?: string };
      };
      const text = body.message?.content ?? "";
      return { text, modelId, providerId: "ollama" };
    },
  };
}
