/**
 * Known ATS / recruiting sender domains for L0 prefilter. AGENTS.md §13.1
 * Keep conservative — false positives only mean we fetch a body.
 */
export const ATS_SENDER_DOMAINS = [
  "greenhouse.io",
  "greenhouse-mail.io",
  "lever.co",
  "hire.lever.co",
  "myworkday.com",
  "myworkdaysite.com",
  "workday.com",
  "ashbyhq.com",
  "icims.com",
  "smartrecruiters.com",
  "successfactors.com",
  "taleo.net",
  "jobvite.com",
  "bamboohr.com",
  "rippling.com",
  "hackerrank.com",
  "codesignal.com",
  "codility.com",
  "hirevue.com",
  "karat.io",
  "coderpad.io",
  "goodtime.io",
  "calendly.com",
  "modernloop.io",
] as const;

export function domainOfAddress(fromAddress: string | undefined): string | null {
  if (!fromAddress) return null;
  const m = fromAddress.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/);
  return m?.[1] ?? null;
}

export function isAtsSenderDomain(domain: string | null): boolean {
  if (!domain) return false;
  return ATS_SENDER_DOMAINS.some(
    (d) => domain === d || domain.endsWith(`.${d}`),
  );
}
