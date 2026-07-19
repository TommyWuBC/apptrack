/**
 * In-memory token-bucket rate limiter (per key / per source). AGENTS.md §20.4 / F9
 * Keys are opaque (site_key or hashed IP) — never log raw IPs.
 */
type Bucket = { tokens: number; updatedAt: number };

export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {}

  /** Returns true if allowed (consumes 1 token). */
  allow(key: string, now = Date.now()): boolean {
    const b = this.buckets.get(key) ?? {
      tokens: this.capacity,
      updatedAt: now,
    };
    const elapsed = Math.max(0, now - b.updatedAt);
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerMs);
    b.updatedAt = now;
    if (b.tokens < 1) {
      this.buckets.set(key, b);
      return false;
    }
    b.tokens -= 1;
    this.buckets.set(key, b);
    return true;
  }

  reset(): void {
    this.buckets.clear();
  }
}

/** Defaults: ~60 req/min per site key; ~30/min per source hash. */
export const siteKeyLimiter = new TokenBucketLimiter(60, 60 / 60_000);
export const sourceLimiter = new TokenBucketLimiter(30, 30 / 60_000);
