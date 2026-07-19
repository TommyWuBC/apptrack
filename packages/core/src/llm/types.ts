/**
 * Provider-agnostic LLM client. AGENTS.md §13 / R-2
 * Adapters live only under packages/core/llm.
 */
export type LlmCompleteInput = {
  system: string;
  user: string;
  maxTokens?: number;
};

export type LlmCompleteResult = {
  text: string;
  modelId: string;
  providerId: string;
};

export interface LlmClient {
  readonly providerId: string;
  readonly modelId: string;
  completeJson(input: LlmCompleteInput): Promise<LlmCompleteResult>;
}

export type LlmProviderId = "anthropic" | "openai" | "ollama";

export type CreateLlmClientOptions = {
  provider: LlmProviderId;
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
  /** Injected fetch for tests */
  fetchImpl?: typeof fetch;
};
