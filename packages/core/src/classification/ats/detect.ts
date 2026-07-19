/**
 * L1 ATS platform detection from sender. AGENTS.md §13.1
 */
import { domainOfAddress } from "./senders.js";

const PLATFORM_DOMAIN_HINTS: Array<{ platform: string; needles: string[] }> = [
  { platform: "greenhouse", needles: ["greenhouse"] },
  { platform: "lever", needles: ["lever"] },
  { platform: "workday", needles: ["workday", "myworkday"] },
  { platform: "ashby", needles: ["ashby"] },
  { platform: "icims", needles: ["icims"] },
  { platform: "smartrecruiters", needles: ["smartrecruiters"] },
  { platform: "hackerrank", needles: ["hackerrank"] },
  { platform: "codesignal", needles: ["codesignal"] },
  { platform: "codility", needles: ["codility"] },
  { platform: "hirevue", needles: ["hirevue"] },
  { platform: "calendly", needles: ["calendly"] },
];

export function detectAtsPlatform(fromAddress?: string, text?: string): string | null {
  const domain = (domainOfAddress(fromAddress) ?? "").toLowerCase();
  const hay = `${domain} ${text ?? ""}`.toLowerCase();
  for (const { platform, needles } of PLATFORM_DOMAIN_HINTS) {
    if (needles.some((n) => hay.includes(n))) return platform;
  }
  return null;
}
