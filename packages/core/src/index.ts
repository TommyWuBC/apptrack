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
