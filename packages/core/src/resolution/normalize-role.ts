/**
 * Role title normalization. AGENTS.md §14.6
 */
export function normalizeRoleTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(req[#:\s-]*)\w+\b/gi, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\b(remote|hybrid|onsite|on-site)\b/gi, " ")
    .replace(/[^\w\s/+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type RoleLevel =
  | "intern"
  | "new_grad"
  | "mid"
  | "senior"
  | "staff"
  | "unknown";

export function inferRoleLevel(titleNorm: string): RoleLevel {
  const t = titleNorm.toLowerCase();
  if (/\b(intern|internship|co-?op)\b/.test(t)) return "intern";
  if (/\b(new\s*grad|university\s*grad|entry[- ]level|junior)\b/.test(t))
    return "new_grad";
  if (/\b(staff|principal)\b/.test(t)) return "staff";
  if (/\b(senior|sr\.?)\b/.test(t)) return "senior";
  if (/\b(mid|ii|iii)\b/.test(t)) return "mid";
  return "unknown";
}

/** Token-overlap similarity for role titles in [0, 1]. */
export function roleTitleSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeRoleTitle(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeRoleTitle(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap += 1;
  }
  return overlap / Math.max(ta.size, tb.size);
}
