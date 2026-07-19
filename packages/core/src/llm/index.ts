import { createAnthropicClient } from "./anthropic.js";
import { createOpenAiClient } from "./openai.js";
import { createOllamaClient } from "./ollama.js";
import type { CreateLlmClientOptions, LlmClient } from "./types.js";

/**
 * Factory for LLM adapters. AGENTS.md §13.2
 */
export function createLlmClient(opts: CreateLlmClientOptions): LlmClient {
  switch (opts.provider) {
    case "anthropic":
      return createAnthropicClient(opts);
    case "openai":
      return createOpenAiClient(opts);
    case "ollama":
      return createOllamaClient(opts);
    default: {
      const _exhaustive: never = opts.provider;
      throw new Error(`unknown_llm_provider:${String(_exhaustive)}`);
    }
  }
}

export type {
  LlmClient,
  LlmCompleteInput,
  LlmCompleteResult,
  LlmProviderId,
  CreateLlmClientOptions,
} from "./types.js";
export { createAnthropicClient } from "./anthropic.js";
export { createOpenAiClient } from "./openai.js";
export { createOllamaClient } from "./ollama.js";
