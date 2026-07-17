/**
 * Browser SDK stub — full implementation in M15. Target <2KB gz.
 */
export function createTracker(_siteKey: string): {
  track: (type: string, props?: Record<string, unknown>) => void;
} {
  return {
    track() {
      /* no-op until M15 */
    },
  };
}
