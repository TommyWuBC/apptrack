import { describe, expect, it, vi } from "vitest";
import { withBackoff, isRetryableStatus } from "./http-backoff.js";

describe("withBackoff", () => {
  it("retries 429 then succeeds", async () => {
    const sleep = vi.fn(async () => {});
    let n = 0;
    const result = await withBackoff(
      async () => {
        n += 1;
        if (n < 3) {
          throw Object.assign(new Error("rate"), { status: 429 });
        }
        return "ok";
      },
      { maxAttempts: 5, baseMs: 1, sleep },
    );
    expect(result).toBe("ok");
    expect(sleep).toHaveBeenCalled();
  });

  it("does not retry 400", async () => {
    await expect(
      withBackoff(
        async () => {
          throw Object.assign(new Error("bad"), { status: 400 });
        },
        { maxAttempts: 3, baseMs: 1, sleep: async () => {} },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("classifies retryable statuses", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(404)).toBe(false);
  });
});
