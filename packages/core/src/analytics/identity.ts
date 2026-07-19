/**
 * Privacy-preserving visitor identity + coarse UA. AGENTS.md §20.3 / INV-8
 * Pure functions — IP must never be persisted by callers after use.
 */
import { createHash } from "node:crypto";

export const ANALYTICS_SESSION_IDLE_MS = 30 * 60 * 1000;
export const ANALYTICS_RETENTION_DAYS_DEFAULT = 396; // ~13 months (D-5)

/** Deterministic daily salt so processes agree without shared memory. */
export function dailyVisitorSalt(
  secret: string,
  now: Date = new Date(),
): string {
  const day = now.toISOString().slice(0, 10); // UTC YYYY-MM-DD
  return createHash("sha256")
    .update(`apptrack-analytics-salt|${secret}|${day}`)
    .digest("hex");
}

/**
 * visitor_hash = sha256(daily_salt || site_key || ip || coarse_ua_family)
 * // AGENTS.md §20.3
 */
export function computeVisitorHash(input: {
  dailySalt: string;
  siteKey: string;
  ip: string;
  uaFamily: string;
}): string {
  return createHash("sha256")
    .update(
      `${input.dailySalt}|${input.siteKey}|${input.ip}|${input.uaFamily}`,
    )
    .digest("hex");
}

export type CoarseUa = {
  deviceCategory: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  browserFamily: string;
};

/** Coarse UA only — no fingerprinting. */
export function parseCoarseUa(ua: string | undefined | null): CoarseUa {
  const s = (ua ?? "").toLowerCase();
  if (!s) return { deviceCategory: "unknown", browserFamily: "unknown" };
  if (/bot|crawl|spider|slurp|facebookexternalhit/i.test(s)) {
    return { deviceCategory: "bot", browserFamily: "bot" };
  }
  let deviceCategory: CoarseUa["deviceCategory"] = "desktop";
  if (/ipad|tablet/i.test(s)) deviceCategory = "tablet";
  else if (/mobi|iphone|android/i.test(s)) deviceCategory = "mobile";

  let browserFamily = "other";
  if (s.includes("edg/")) browserFamily = "edge";
  else if (s.includes("chrome/") || s.includes("crios/"))
    browserFamily = "chrome";
  else if (s.includes("firefox/") || s.includes("fxios/"))
    browserFamily = "firefox";
  else if (s.includes("safari/") && !s.includes("chrome"))
    browserFamily = "safari";
  else if (s.includes("opera") || s.includes("opr/")) browserFamily = "opera";

  return { deviceCategory, browserFamily };
}

export type GeoResult = {
  country: string | null;
  region: string | null;
  city: string | null;
};

/**
 * Sessionize ordered events for one visitor into 30-min inactivity windows.
 * Pure — used by analytics.aggregate. AGENTS.md §20.4
 */
export function sessionizeEvents<
  T extends { occurredAt: Date; path?: string | null },
>(
  events: T[],
  idleMs: number = ANALYTICS_SESSION_IDLE_MS,
): Array<{ startedAt: Date; endedAt: Date; events: T[]; entryPath: string | null }> {
  if (events.length === 0) return [];
  const ordered = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  const sessions: Array<{
    startedAt: Date;
    endedAt: Date;
    events: T[];
    entryPath: string | null;
  }> = [];

  let current: {
    startedAt: Date;
    endedAt: Date;
    events: T[];
    entryPath: string | null;
  } | null = null;

  for (const e of ordered) {
    if (
      !current ||
      e.occurredAt.getTime() - current.endedAt.getTime() > idleMs
    ) {
      if (current) sessions.push(current);
      current = {
        startedAt: e.occurredAt,
        endedAt: e.occurredAt,
        events: [e],
        entryPath: e.path ?? null,
      };
    } else {
      current.events.push(e);
      current.endedAt = e.occurredAt;
    }
  }
  if (current) sessions.push(current);
  return sessions;
}

export function referrerHostFromProps(
  props: Record<string, unknown> | undefined,
  fallback?: string | null,
): string | null {
  const raw =
    (typeof props?.referrer === "string" ? props.referrer : null) ??
    fallback ??
    null;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return raw.slice(0, 200);
  }
}

export function utmFromProps(
  props: Record<string, unknown> | undefined,
): Record<string, string> | null {
  if (!props) return null;
  const utm: Record<string, string> = {};
  for (const k of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]) {
    const v = props[k];
    if (typeof v === "string" && v.length > 0) utm[k] = v.slice(0, 200);
  }
  return Object.keys(utm).length > 0 ? utm : null;
}
