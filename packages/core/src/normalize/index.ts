/**
 * Email normalization pipeline. AGENTS.md §12
 * Pure: Buffer/strings in → NormalizedEmailV1 out. No fetch (INV-6).
 */
import { parseCalendarIcs, type CalendarEventNormalized } from "./calendar.js";
import { extractLinks, type ExtractedLink } from "./links.js";
import { htmlToText, parseMimeBuffer } from "./parse-mime.js";
import { stripQuotesAndSignatures } from "./quotes.js";
import { sanitizeEmailHtml } from "./sanitize.js";
import { NORMALIZER_VERSION } from "./version.js";

export type NormalizeEmailInput = {
  rawMime?: Buffer;
  textPlain?: string;
  html?: string;
  headers?: Record<string, string>;
  subject?: string;
};

export type NormalizedEmailV1 = {
  normalizerVersion: string;
  textPlain: string;
  textFull: string;
  sanitizedHtml: string | null;
  detectedLanguage: string | null;
  links: ExtractedLink[];
  calendarEvent: CalendarEventNormalized | null;
  subject?: string;
  attachmentMeta: Array<{
    filename?: string;
    mimeType?: string;
    sizeBytes: number;
  }>;
};

/** Tiny heuristic — not a full lang-detect lib. */
export function detectLanguageHeuristic(text: string): string | null {
  if (!text.trim()) return null;
  // Hebrew / Arabic ranges → mark rtl-ish
  if (/[\u0590-\u05FF]/.test(text)) return "he";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[àâäéèêëïîôùûüç]/i.test(text)) return "fr";
  return "en";
}

export async function normalizeEmail(
  input: NormalizeEmailInput,
): Promise<NormalizedEmailV1> {
  let text: string | undefined = input.textPlain;
  let html: string | undefined = input.html;
  let subject = input.subject;
  let calendarParts: string[] = [];
  const attachmentMeta: NormalizedEmailV1["attachmentMeta"] = [];

  if (input.rawMime?.length) {
    const parsed = await parseMimeBuffer(input.rawMime);
    text = parsed.text ?? text;
    html = parsed.html ?? html;
    subject = parsed.subject ?? subject;
    calendarParts = parsed.calendarParts;
    for (const a of parsed.attachments) {
      attachmentMeta.push({
        filename: a.filename,
        mimeType: a.contentType,
        sizeBytes: a.size,
      });
    }
  }

  if (!text && html) {
    text = htmlToText(html);
  }
  if (!text) {
    text = "";
  }

  const textFull = text;
  const textPlain = stripQuotesAndSignatures(textFull);
  const sanitizedHtml = html ? sanitizeEmailHtml(html) : null;
  const links = extractLinks({ html: sanitizedHtml, text: textFull });

  let calendarEvent: CalendarEventNormalized | null = null;
  for (const part of calendarParts) {
    calendarEvent = parseCalendarIcs(part);
    if (calendarEvent) break;
  }

  return {
    normalizerVersion: NORMALIZER_VERSION,
    textPlain,
    textFull,
    sanitizedHtml,
    detectedLanguage: detectLanguageHeuristic(textPlain || textFull),
    links,
    calendarEvent,
    subject,
    attachmentMeta,
  };
}

export { NORMALIZER_VERSION } from "./version.js";
export { sanitizeEmailHtml } from "./sanitize.js";
export { stripQuotesAndSignatures } from "./quotes.js";
export { extractLinks, isTrackingUrl, unwrapTrackingUrl } from "./links.js";
export { parseCalendarIcs } from "./calendar.js";
export type { ExtractedLink } from "./links.js";
export type { CalendarEventNormalized } from "./calendar.js";
