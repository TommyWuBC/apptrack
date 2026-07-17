/**
 * Retry with exponential backoff + jitter for 429/5xx. AGENTS.md §11.3
 */
export type RetryOpts = {
  maxAttempts?: number;
  baseMs?: number;
  /** Injected for tests */
  sleep?: (ms: number) => Promise<void>;
};

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const baseMs = opts.baseMs ?? 200;
  const sleep =
    opts.sleep ??
    ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number }).status;
      const code = (err as { code?: string }).code;
      // Never retry history-expired (F1) or client errors other than 429
      if (code === "HISTORY_EXPIRED") throw err;
      const retryable =
        status != null ? isRetryableStatus(status) : true;
      if (!retryable || attempt === maxAttempts) throw err;
      const jitter = Math.floor(Math.random() * baseMs);
      await sleep(baseMs * 2 ** (attempt - 1) + jitter);
    }
  }
  throw lastErr;
}
