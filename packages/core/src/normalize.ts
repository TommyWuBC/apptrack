/** Normalize a company name for alias lookup (strip legal suffixes, collapse whitespace). */
export function normalizeCompanyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b\.?/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Health ping used by M1 acceptance — proves core is wired. */
export function coreHealth(): { ok: true; package: "core" } {
  return { ok: true, package: "core" };
}
