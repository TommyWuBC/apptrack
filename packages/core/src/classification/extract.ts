/**
 * Lightweight field extraction from subject/body. AGENTS.md §13 / FR-2
 */
import type { ExtractionV1 } from "@apptrack/shared";

const COMPANIES = [
  "Initech",
  "Hooli",
  "Pied Piper",
  "Massive Dynamic",
  "Acme Corp",
  "Globex",
];

export function extractFields(opts: {
  subject?: string;
  text?: string;
  atsPlatform?: string | null;
  links?: Array<{ url: string }>;
}): ExtractionV1 {
  const hay = `${opts.subject ?? ""}\n${opts.text ?? ""}`;
  let company: string | null = null;
  for (const c of COMPANIES) {
    if (hay.includes(c)) {
      company = c;
      break;
    }
  }

  let roleTitle: string | null = null;
  const rolePatterns = [
    /(?:for(?: the)?|for)\s+([A-Z][^.\n]{3,60}?)\s+(?:role|position|at)/i,
    /(?:invite you to interview for|assessment for|interest in)\s+([^.\n]{3,60}?)\s+at\s+/i,
    /—\s*([^,\n]+),\s*[A-Z]/, // "Interview invitation — Role, Company"
  ];
  for (const re of rolePatterns) {
    const m = hay.match(re);
    if (m?.[1]) {
      roleTitle = m[1].trim().replace(/\s+at\s+.*$/i, "");
      break;
    }
  }

  const portal =
    opts.links?.find((l) => /portal/i.test(l.url))?.url ??
    hay.match(/https?:\/\/jobs\.[^\s]+/i)?.[0] ??
    null;

  const appType = /intern|co-?op/i.test(hay)
    ? ("internship" as const)
    : /new\s*grad/i.test(hay)
      ? ("new_grad" as const)
      : null;

  return {
    company,
    roleTitle,
    applicationType: appType,
    portalUrl: portal,
    atsPlatform: opts.atsPlatform ?? null,
    confidence: company ? 0.85 : 0.5,
  };
}
