/**
 * Pure domain helpers. No I/O, no DB, no fetch. AGENTS.md §8.1
 */

export { normalizeCompanyName, coreHealth } from "./normalize.js";
export {
  encrypt,
  decrypt,
  packEncrypted,
  unpackEncrypted,
  decodeEncryptionKey,
} from "./crypto/index.js";
export type { EncryptedPayload } from "./crypto/index.js";
export {
  prefilterEmail,
  type PrefilterDecision,
  type PrefilterHeaders,
} from "./classification/prefilter.js";
export {
  ATS_SENDER_DOMAINS,
  domainOfAddress,
  isAtsSenderDomain,
} from "./classification/ats/senders.js";
export {
  classifyEmail,
  CLASSIFIER_VERSION,
  RULES_VERSION,
  PROMPT_VERSION,
  L3_CONFIDENCE_THRESHOLD,
  shouldInvokeL3,
  arbitrate,
  runL3Extraction,
  type ClassifyInput,
  type ClassifyOptions,
} from "./classification/classify.js";
export { detectAtsPlatform } from "./classification/ats/detect.js";
export { EXTRACTION_SCHEMA_VERSION } from "./classification/version.js";
export {
  createLlmClient,
  createAnthropicClient,
  createOpenAiClient,
  createOllamaClient,
} from "./llm/index.js";
export type {
  LlmClient,
  LlmCompleteInput,
  LlmCompleteResult,
  LlmProviderId,
  CreateLlmClientOptions,
} from "./llm/index.js";
export {
  normalizeEmail,
  NORMALIZER_VERSION,
  sanitizeEmailHtml,
  stripQuotesAndSignatures,
  extractLinks,
  isTrackingUrl,
  unwrapTrackingUrl,
  parseCalendarIcs,
  detectLanguageHeuristic,
} from "./normalize/index.js";
export type {
  NormalizeEmailInput,
  NormalizedEmailV1,
  ExtractedLink,
  CalendarEventNormalized,
} from "./normalize/index.js";
export {
  matchApplication,
  MATCHER_VERSION,
  MATCH_WEIGHTS,
  AUTO_ATTACH_THRESHOLD,
  AUTO_ATTACH_MARGIN,
  REVIEW_FLOOR,
  computeSignals,
  clampScore,
} from "./matching/index.js";
export type {
  MatchInput,
  MatchCandidateContext,
  MatchEmailContext,
} from "./matching/index.js";
export {
  resolveCompany,
  FUZZY_MERGE_THRESHOLD,
  jaroWinkler,
  normalizeRoleTitle,
  inferRoleLevel,
  roleTitleSimilarity,
  SEED_COMPANY_ALIASES,
} from "./resolution/index.js";
export type {
  AliasRecord,
  ResolveCompanyInput,
  ResolveCompanyResult,
  RoleLevel,
  SeedAlias,
} from "./resolution/index.js";
export {
  reduce,
  REDUCER_VERSION,
  orderEvents,
  compareReducerEvents,
  applyCorrections,
  activeCorrections,
  isFieldLocked,
  MEANINGFUL,
  TERMINAL,
} from "./statemachine/index.js";
export type {
  UserCorrection,
  ProjectionFields,
} from "./statemachine/index.js";
export {
  evaluateGhost,
  resolveGhostThresholds,
  DEFAULT_GHOST_THRESHOLDS,
  GHOST_VERSION,
} from "./ghosting/index.js";
export type {
  GhostEvaluateInput,
  ResolveThresholdsInput,
} from "./ghosting/index.js";
export {
  dailyVisitorSalt,
  computeVisitorHash,
  parseCoarseUa,
  sessionizeEvents,
  partitionIncrementalEvents,
  referrerHostFromProps,
  utmFromProps,
  ANALYTICS_SESSION_IDLE_MS,
  ANALYTICS_RETENTION_DAYS_DEFAULT,
} from "./analytics/index.js";
export type { CoarseUa, GeoResult } from "./analytics/index.js";
