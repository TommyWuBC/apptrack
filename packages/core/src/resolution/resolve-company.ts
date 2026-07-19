/**
 * Pure company resolution. AGENTS.md §14
 * No silent merges: exact alias → hit; fuzzy ≥ 0.85 → suggest; else new.
 */
import { normalizeCompanyName } from "../normalize.js";
import { jaroWinkler } from "./jaro-winkler.js";
import { SEED_COMPANY_ALIASES } from "./seed-aliases.js";

export const FUZZY_MERGE_THRESHOLD = 0.85;

export type AliasRecord = {
  companyId: string;
  canonicalName: string;
  alias: string;
  aliasType: string;
};

export type ResolveCompanyInput = {
  /** Extracted company name from classification */
  companyName?: string | null;
  /** Sender / employer domain (not ATS platform domain) */
  domain?: string | null;
  /** Existing aliases from DB (may be empty) */
  aliases: AliasRecord[];
  /** Include built-in seed aliases when DB is empty / for offline matching */
  includeSeed?: boolean;
};

export type ResolveCompanyResult =
  | {
      kind: "exact";
      companyId: string | null;
      canonicalName: string;
      matchedAlias: string;
      source: "db" | "seed";
    }
  | {
      kind: "fuzzy_suggest";
      companyId: string | null;
      canonicalName: string;
      similarity: number;
      candidateName: string;
    }
  | {
      kind: "create_new";
      canonicalName: string;
      primaryDomain: string | null;
    }
  | { kind: "unresolved" };

function buildSeedAliasRecords(): AliasRecord[] {
  const out: AliasRecord[] = [];
  for (const seed of SEED_COMPANY_ALIASES) {
    for (const a of seed.aliases) {
      out.push({
        companyId: `seed:${seed.canonicalName}`,
        canonicalName: seed.canonicalName,
        alias: a.alias,
        aliasType: a.aliasType,
      });
    }
  }
  return out;
}

/**
 * Resolve a company candidate to an exact alias hit, fuzzy suggestion, or new.
 * // AGENTS.md §14.4
 */
export function resolveCompany(input: ResolveCompanyInput): ResolveCompanyResult {
  const nameNorm = input.companyName ? normalizeCompanyName(input.companyName) : "";
  const domainNorm = input.domain?.toLowerCase().replace(/^www\./, "") ?? "";

  const pool = [
    ...input.aliases,
    ...(input.includeSeed !== false ? buildSeedAliasRecords() : []),
  ];

  if (domainNorm) {
    const domainHit = pool.find(
      (a) =>
        (a.aliasType === "domain" || a.aliasType === "email_domain") &&
        a.alias.toLowerCase() === domainNorm,
    );
    if (domainHit) {
      return {
        kind: "exact",
        companyId: domainHit.companyId.startsWith("seed:") ? null : domainHit.companyId,
        canonicalName: domainHit.canonicalName,
        matchedAlias: domainHit.alias,
        source: domainHit.companyId.startsWith("seed:") ? "seed" : "db",
      };
    }
  }

  if (nameNorm) {
    const nameHit = pool.find(
      (a) => a.aliasType === "name" && normalizeCompanyName(a.alias) === nameNorm,
    );
    if (nameHit) {
      return {
        kind: "exact",
        companyId: nameHit.companyId.startsWith("seed:") ? null : nameHit.companyId,
        canonicalName: nameHit.canonicalName,
        matchedAlias: nameHit.alias,
        source: nameHit.companyId.startsWith("seed:") ? "seed" : "db",
      };
    }

    // Fuzzy against known canonical names (unique set)
    let best: { rec: AliasRecord; sim: number } | null = null;
    const seen = new Set<string>();
    for (const a of pool) {
      const key = a.canonicalName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const sim = jaroWinkler(nameNorm, normalizeCompanyName(a.canonicalName));
      if (!best || sim > best.sim) best = { rec: a, sim };
    }
    if (best && best.sim >= FUZZY_MERGE_THRESHOLD) {
      return {
        kind: "fuzzy_suggest",
        companyId: best.rec.companyId.startsWith("seed:") ? null : best.rec.companyId,
        canonicalName: best.rec.canonicalName,
        similarity: best.sim,
        candidateName: input.companyName!,
      };
    }

    return {
      kind: "create_new",
      canonicalName: input.companyName!.trim(),
      primaryDomain: domainNorm || null,
    };
  }

  if (domainNorm) {
    return {
      kind: "create_new",
      canonicalName: domainNorm.split(".")[0] ?? domainNorm,
      primaryDomain: domainNorm,
    };
  }

  return { kind: "unresolved" };
}
