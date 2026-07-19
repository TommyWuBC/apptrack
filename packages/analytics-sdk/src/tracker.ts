/**
 * Apptrack analytics browser tracker — zero runtime deps.
 * Cookie-free by default; no localStorage. AGENTS.md §20.2 / M15
 */

export type TrackProps = Record<string, string | number | boolean | undefined>;

export type TrackerOptions = {
  siteKey: string;
  /** Full ingest URL, e.g. https://tracker/api/v1/analytics/events */
  endpoint: string;
  /** Client override; `off` disables all capture */
  mode?: string;
  /** Max events per beacon batch (server cap is 25) */
  batchSize?: number;
  /** Flush interval ms */
  flushMs?: number;
  /** Injectables for tests */
  send?: (url: string, body: string) => void;
  now?: () => Date;
  uuid?: () => string;
  getPath?: () => string;
  getSearch?: () => string;
  /** Default true; set false in unit tests that drive page views manually */
  autoPageView?: boolean;
  /** Default true; set false to skip history/popstate hooks in tests */
  hookHistory?: boolean;
};

const PROP_ALLOW = new Set([
  "title",
  "project",
  "label",
  "href",
  "src",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
]);

const EVENT_ALLOW = new Set([
  "page_view",
  "project_view",
  "resume_view",
  "resume_download",
  "github_click",
  "contact_click",
  "session_start",
  "session_end",
  "custom",
]);

type Queued = {
  eventId: string;
  eventType: string;
  path: string;
  occurredAt: string;
  props?: Record<string, string>;
  srcToken?: string;
};

function defaultUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function cleanProps(props?: TrackProps): Record<string, string> | undefined {
  if (!props) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!PROP_ALLOW.has(k) || v === undefined) continue;
    out[k] = String(v).slice(0, 500);
  }
  return Object.keys(out).length ? out : undefined;
}

function defaultSend(url: string, body: string): void {
  const blob = new Blob([body], { type: "application/json" });
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const ok = navigator.sendBeacon(url, blob);
    if (ok) return;
  }
  if (typeof fetch === "function") {
    void fetch(url, {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    }).catch(() => {
      /* swallow — analytics must never break the host page */
    });
  }
}

export type Tracker = {
  track: (type: string, props?: TrackProps) => void;
  flush: () => void;
  destroy: () => void;
};

/**
 * Create a tracker instance. Pure enough to unit-test with injected send.
 */
export function createTracker(opts: TrackerOptions): Tracker {
  if (!opts.siteKey || opts.mode === "off") {
    return {
      track() {},
      flush() {},
      destroy() {},
    };
  }

  const batchSize = opts.batchSize ?? 10;
  const flushMs = opts.flushMs ?? 2000;
  const send = opts.send ?? defaultSend;
  const uuid = opts.uuid ?? defaultUuid;
  const now = opts.now ?? (() => new Date());
  const getPath = opts.getPath ?? (() => location.pathname);
  const getSearch = opts.getSearch ?? (() => location.search);

  let srcToken: string | undefined;
  try {
    const q = new URLSearchParams(getSearch());
    const s = q.get("src");
    if (s) srcToken = s.slice(0, 64);
  } catch {
    /* ignore */
  }

  const queue: Queued[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastPath = "";

  function schedule(): void {
    if (timer != null) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, flushMs);
  }

  function flush(): void {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    while (queue.length > 0) {
      const chunk = queue.splice(0, Math.min(batchSize, 25));
      const body = JSON.stringify({ siteKey: opts.siteKey, events: chunk });
      // Soft size guard (~8KB server limit)
      if (body.length > 8000 && chunk.length > 1) {
        queue.unshift(...chunk.slice(1));
        send(
          opts.endpoint,
          JSON.stringify({ siteKey: opts.siteKey, events: [chunk[0]] }),
        );
        continue;
      }
      send(opts.endpoint, body);
    }
  }

  function track(type: string, props?: TrackProps): void {
    const eventType = EVENT_ALLOW.has(type) ? type : "custom";
    const path = getPath() + getSearch();
    const cleaned = cleanProps(props);
    const ev: Queued = {
      eventId: uuid(),
      eventType,
      path,
      occurredAt: now().toISOString(),
    };
    if (cleaned) ev.props = cleaned;
    if (srcToken) ev.srcToken = srcToken;
    queue.push(ev);
    if (queue.length >= batchSize) flush();
    else schedule();
  }

  function pageView(): void {
    const path = getPath() + getSearch();
    if (path === lastPath) return;
    lastPath = path;
    const title =
      typeof document !== "undefined" ? document.title : undefined;
    track("page_view", title ? { title } : undefined);
  }

  // SPA hooks
  if (
    opts.hookHistory !== false &&
    typeof history !== "undefined" &&
    typeof window !== "undefined"
  ) {
    const wrap = (fn: typeof history.pushState) =>
      function (this: History, ...args: Parameters<typeof history.pushState>) {
        const ret = fn.apply(this, args);
        pageView();
        return ret;
      };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener("popstate", pageView);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  // Initial page view
  if (opts.autoPageView !== false) {
    pageView();
  }

  return {
    track,
    flush,
    destroy() {
      flush();
      if (timer != null) clearTimeout(timer);
    },
  };
}

/** Resolve ingest URL from the script's own src (.../sdk.js → .../api/v1/analytics/events). */
export function endpointFromScriptSrc(src: string): string {
  try {
    const base =
      typeof location !== "undefined" && location.href
        ? location.href
        : "http://localhost/";
    const u = new URL(src, base);
    u.pathname = u.pathname.replace(/\/sdk\.js$/i, "/api/v1/analytics/events");
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "/api/v1/analytics/events";
  }
}

export function readScriptConfig(script: HTMLScriptElement | null): {
  siteKey: string;
  mode: string;
  endpoint: string;
} | null {
  if (!script) return null;
  const siteKey = script.getAttribute("data-site-key") ?? "";
  if (!siteKey) return null;
  const mode = script.getAttribute("data-mode") ?? "full";
  const endpointAttr = script.getAttribute("data-endpoint");
  const endpoint =
    endpointAttr ||
    endpointFromScriptSrc(script.src || "/sdk.js");
  return { siteKey, mode, endpoint };
}
