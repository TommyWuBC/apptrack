/**
 * Banned correlation UI/explanation phrasings. AGENTS.md §21.2
 * These must never appear in stored explanations or user-facing copy.
 */
export const BANNED_CORRELATION_PHRASES = [
  "recruiter viewed",
  "visited by",
  "definitely",
  "confirmed",
] as const;

/** Allowed framing vocabulary (documentation / tests). */
export const ALLOWED_CORRELATION_PHRASES = [
  "possible application-related visit",
  "estimated association",
  "anonymous visit potentially associated",
] as const;

export function containsBannedCorrelationPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_CORRELATION_PHRASES) {
    if (lower.includes(phrase)) return phrase;
    // "visited by <Company>" pattern
    if (phrase === "visited by" && /visited by\s+\S+/i.test(text)) return phrase;
  }
  // Person-name claim: "visited by Jane" already covered; also block "recruiter <Name> viewed"
  if (/recruiter\s+[A-Z][a-z]+\s+viewed/i.test(text)) return "recruiter viewed";
  return null;
}
