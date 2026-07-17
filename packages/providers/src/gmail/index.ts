export {
  GMAIL_READONLY_SCOPE,
  OPENID_EMAIL_SCOPES,
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_REVOKE_URL,
  GOOGLE_USERINFO_URL,
  generateCodeVerifier,
  codeChallengeS256,
  generateOAuthState,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshAccessToken,
  revokeToken,
  fetchUserEmail,
} from "./oauth.js";
export type { GoogleOAuthConfig, TokenSet } from "./oauth.js";
export {
  createGmailEmailProvider,
  GmailEmailProvider,
  HistoryExpiredError,
} from "./adapter.js";
export type {
  GmailAccessTokenProvider,
  GmailEmailProviderOpts,
} from "./adapter.js";
