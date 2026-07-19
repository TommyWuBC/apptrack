export { jaroWinkler } from "./jaro-winkler.js";
export {
  normalizeRoleTitle,
  inferRoleLevel,
  roleTitleSimilarity,
  type RoleLevel,
} from "./normalize-role.js";
export {
  resolveCompany,
  FUZZY_MERGE_THRESHOLD,
  type AliasRecord,
  type ResolveCompanyInput,
  type ResolveCompanyResult,
} from "./resolve-company.js";
export { SEED_COMPANY_ALIASES, type SeedAlias } from "./seed-aliases.js";
