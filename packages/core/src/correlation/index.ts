export {
  CORRELATION_VERSION,
  CORRELATION_BAND_NONE_MAX,
  CORRELATION_BAND_LOW_MAX,
} from "./version.js";
export {
  BANNED_CORRELATION_PHRASES,
  ALLOWED_CORRELATION_PHRASES,
  containsBannedCorrelationPhrase,
} from "./language.js";
export { scoreCorrelation } from "./score.js";
export type {
  ScoreCorrelationInput,
  CorrelationApplicationInput,
  CorrelationSessionInput,
  CorrelationSessionEvent,
  CorrelationCompanyLocation,
} from "./score.js";
