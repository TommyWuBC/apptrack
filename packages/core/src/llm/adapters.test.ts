import { describe, expect, it, vi } from "vitest";
import {
  createAnthropicClient,
  createOpenAiClient,
  createOllamaClient,
} from "./index.js";

describe("llm adapters", () => {
  it("anthropic posts to messages API", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        content: [{ type: "text", text: '{"justification":"ok"}' }],
      }),
    );
    const client = createAnthropicClient({
      provider: "anthropic",
      apiKey: "sk-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const out = await client.completeJson({
      system: "sys",
      user: "user",
    });
    expect(out.text).toContain("justification");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain("/v1/messages");
    expect((init as RequestInit).headers).toMatchObject({
      "x-api-key": "sk-test",
    });
  });

  it("openai posts chat completions", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: '{"justification":"ok"}' } }],
      }),
    );
    const client = createOpenAiClient({
      provider: "openai",
      apiKey: "sk-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.completeJson({ system: "s", user: "u" });
    const [url] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain("/v1/chat/completions");
  });

  it("ollama posts to local /api/chat", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        message: { content: '{"justification":"local"}' },
      }),
    );
    const client = createOllamaClient({
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const out = await client.completeJson({ system: "s", user: "u" });
    expect(out.providerId).toBe("ollama");
    expect(String(fetchImpl.mock.calls[0]![0])).toContain("/api/chat");
  });
});
