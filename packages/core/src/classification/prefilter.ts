/**
 * L0 prefilter — headers only. AGENTS.md §13.1 / §11.3.5
 * Pure function: decide whether to fetch a full body during sync.
 */
import { domainOfAddress, isAtsSenderDomain } from "./ats/senders.js";

export type PrefilterDecision =
  | { action: "fetch"; reason: string }
  | { action: "skip"; reason: string; eventHint?: "newsletter_ignore" };

export type PrefilterHeaders = {
  fromAddress?: string;
  listId?: string;
  listUnsubscribe?: string;
  subject?: string;
};

/**
 * Headers-only gate before fetching full MIME.
 * ATS / recruiting domains → fetch. Bulk List-Id newsletters → skip candidate.
 * Default → fetch (recall over precision at ingest).
 */
export function prefilterEmail(headers: PrefilterHeaders): PrefilterDecision {
  const domain = domainOfAddress(headers.fromAddress);
  if (isAtsSenderDomain(domain)) {
    return {
      action: "fetch",
      reason: `ATS/recruiting sender domain: ${domain}`,
    };
  }

  const listId = (headers.listId ?? "").toLowerCase();
  const hasListUnsub = Boolean(headers.listUnsubscribe);
  if (listId && hasListUnsub && !isAtsSenderDomain(domain)) {
    return {
      action: "skip",
      reason: "List-Id + List-Unsubscribe looks like bulk newsletter",
      eventHint: "newsletter_ignore",
    };
  }

  return {
    action: "fetch",
    reason: "default recall-oriented fetch",
  };
}
