/**
 * Browser IIFE entry — auto-boots from <script data-site-key>.
 */
import { createTracker, readScriptConfig, type Tracker } from "./tracker.js";

declare global {
  interface Window {
    apptrack?: Tracker & { q?: unknown[] };
  }
}

const script =
  typeof document !== "undefined"
    ? (document.currentScript as HTMLScriptElement | null)
    : null;

const cfg = readScriptConfig(script);
if (cfg && typeof window !== "undefined") {
  const tracker = createTracker({
    siteKey: cfg.siteKey,
    endpoint: cfg.endpoint,
    mode: cfg.mode,
  });
  window.apptrack = tracker;
}
