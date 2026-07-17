/**
 * In-memory PKCE OAuth state (single-process v1).
 * Survives only for the authorize → callback round-trip.
 */
export type PendingOAuth = {
  codeVerifier: string;
  userId: string;
  createdAt: number;
};

const store = new Map<string, PendingOAuth>();
const TTL_MS = 10 * 60 * 1000;

export function putOAuthState(state: string, value: PendingOAuth): void {
  prune();
  store.set(state, value);
}

export function takeOAuthState(state: string): PendingOAuth | null {
  prune();
  const v = store.get(state) ?? null;
  if (v) store.delete(state);
  return v;
}

/** Test helper */
export function clearOAuthStates(): void {
  store.clear();
}

function prune(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now - v.createdAt > TTL_MS) store.delete(k);
  }
}
