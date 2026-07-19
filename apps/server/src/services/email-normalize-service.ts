/**
 * email.normalize orchestration. AGENTS.md §12 / M6
 * Pure normalize in @apptrack/core; this wires DB I/O.
 */
import {
  normalizeEmail,
  NORMALIZER_VERSION,
  type NormalizedEmailV1,
} from "@apptrack/core";
import { repos, type Database } from "@apptrack/db";
import type { RawEmail } from "@apptrack/providers";

const { emailsRepo, normalizedEmailsRepo } = repos;

export type NormalizeResult = {
  messageId: string;
  inserted: boolean;
  normalizerVersion: string;
  normalized: NormalizedEmailV1;
};

/** Normalize from an in-memory RawEmail (typical sync path). */
export async function normalizeAndStoreFromRaw(
  db: Database,
  messageId: string,
  raw: RawEmail,
): Promise<NormalizeResult> {
  const normalized = await normalizeEmail({
    rawMime: raw.rawMime,
    textPlain: raw.textPlain,
    html: raw.html,
    headers: raw.headers,
    subject: raw.subject,
  });
  if (!raw.rawMime?.length && !raw.textPlain && !raw.html && !normalized.textFull) {
    const fallback = await normalizeEmail({
      textPlain: [raw.subject, raw.snippet].filter(Boolean).join("\n\n"),
      headers: raw.headers,
      subject: raw.subject,
    });
    return persist(db, messageId, fallback);
  }
  return persist(db, messageId, normalized);
}

/** Re-normalize from stored message fields / optional MIME buffer. */
export async function runNormalizeMessage(
  db: Database,
  messageId: string,
  opts: { rawMime?: Buffer } = {},
): Promise<NormalizeResult> {
  const msg = await emailsRepo.getEmailMessageById(db, messageId);
  if (!msg) throw new Error("message_not_found");

  const headers = (msg.headersSubset as Record<string, string> | null) ?? undefined;

  const normalized = await normalizeEmail({
    rawMime: opts.rawMime,
    textPlain: opts.rawMime
      ? undefined
      : [msg.subject, msg.snippet].filter(Boolean).join("\n\n"),
    headers,
    subject: msg.subject ?? undefined,
  });

  return persist(db, messageId, normalized);
}

async function persist(
  db: Database,
  messageId: string,
  normalized: NormalizedEmailV1,
): Promise<NormalizeResult> {
  const { inserted } = await normalizedEmailsRepo.insertNormalizedEmailIdempotent(db, {
    messageId,
    textPlain: normalized.textPlain,
    textFull: normalized.textFull,
    sanitizedHtml: normalized.sanitizedHtml,
    detectedLanguage: normalized.detectedLanguage,
    links: normalized.links,
    calendarEvent: normalized.calendarEvent,
    normalizerVersion: normalized.normalizerVersion,
    attachments: normalized.attachmentMeta.map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    })),
  });

  return {
    messageId,
    inserted,
    normalizerVersion: NORMALIZER_VERSION,
    normalized,
  };
}
