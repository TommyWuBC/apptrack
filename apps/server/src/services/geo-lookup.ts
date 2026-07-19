/**
 * Coarse geolocation helpers. IP is never persisted (INV-8). AGENTS.md §20.3
 */
import type { GeoResult } from "@apptrack/core";

export type GeoLookup = (ip: string) => GeoResult | null;

/**
 * Resolve coarse geo for an ingest request.
 * - `off` / disabled: null
 * - `no_geo`: country from CDN header only (no IP lookup)
 * - `full`: optional in-memory lookup, then CDN fallback; IP discarded by caller
 */
export function resolveGeo(opts: {
  mode: string;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  lookup?: GeoLookup | null;
}): GeoResult {
  if (opts.mode === "off" || opts.mode === "no_geo") {
    if (opts.mode === "no_geo") {
      const country = cdnCountry(opts.headers);
      return { country, region: null, city: null };
    }
    return { country: null, region: null, city: null };
  }

  if (opts.lookup && opts.ip) {
    const hit = opts.lookup(opts.ip);
    if (hit) return hit;
  }

  const country = cdnCountry(opts.headers);
  return { country, region: null, city: null };
}

function header(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === "string" ? v : null;
}

function cdnCountry(
  headers: Record<string, string | string[] | undefined> | undefined,
): string | null {
  const raw =
    header(headers, "cf-ipcountry") ??
    header(headers, "x-vercel-ip-country") ??
    header(headers, "x-country-code");
  if (!raw || raw === "XX" || raw.length > 8) return null;
  return raw.toUpperCase();
}
