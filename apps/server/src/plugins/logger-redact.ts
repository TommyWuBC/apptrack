/**
 * Pino redact paths for Fastify logger. AGENTS.md §25.4 / T11
 * Keep in one place so security tests can assert coverage.
 */
export const LOG_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.passwordHash",
  "*.refreshToken",
  "*.accessToken",
  "*.encrypted_refresh_token",
  "*.encrypted_access_token",
  "*.encryptedRefreshToken",
  "*.encryptedAccessToken",
  "req.query.code",
  // Email PII — never at info level even if a caller spreads a message row
  "*.subject",
  "*.textPlain",
  "*.textFull",
  "*.sanitizedHtml",
  "*.fromAddress",
  "*.toAddresses",
  "*.snippet",
  "*.rawMime",
  "*.raw_encrypted",
] as const;

export type LogRedactPaths = typeof LOG_REDACT_PATHS;

/** True if a structured log object field name is considered sensitive. */
export function isSensitiveLogField(field: string): boolean {
  const lower = field.toLowerCase();
  const forbidden = [
    "password",
    "refreshtoken",
    "accesstoken",
    "authorization",
    "cookie",
    "subject",
    "textplain",
    "textfull",
    "sanitizedhtml",
    "fromaddress",
    "toaddresses",
    "snippet",
    "rawmime",
  ];
  return forbidden.some((f) => lower.includes(f));
}
