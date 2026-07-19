/**
 * Seed company aliases (synthetic + common tech employers). AGENTS.md §14.2
 * Used for exact alias hits only — never silent fuzzy merges.
 */
export type SeedAlias = {
  canonicalName: string;
  aliases: Array<{ alias: string; aliasType: "name" | "domain" | "email_domain" }>;
};

export const SEED_COMPANY_ALIASES: SeedAlias[] = [
  {
    canonicalName: "Initech",
    aliases: [
      { alias: "initech", aliasType: "name" },
      { alias: "initech.com", aliasType: "domain" },
      { alias: "initech.com", aliasType: "email_domain" },
    ],
  },
  {
    canonicalName: "Hooli",
    aliases: [
      { alias: "hooli", aliasType: "name" },
      { alias: "hooli.com", aliasType: "domain" },
      { alias: "hooli.com", aliasType: "email_domain" },
    ],
  },
  {
    canonicalName: "Pied Piper",
    aliases: [
      { alias: "pied piper", aliasType: "name" },
      { alias: "piedpiper", aliasType: "name" },
      { alias: "piedpiper.com", aliasType: "domain" },
    ],
  },
  {
    canonicalName: "Google",
    aliases: [
      { alias: "google", aliasType: "name" },
      { alias: "google.com", aliasType: "domain" },
      { alias: "googlemail.com", aliasType: "email_domain" },
    ],
  },
  {
    canonicalName: "Meta",
    aliases: [
      { alias: "meta", aliasType: "name" },
      { alias: "facebook", aliasType: "name" },
      { alias: "meta.com", aliasType: "domain" },
      { alias: "fb.com", aliasType: "domain" },
    ],
  },
  {
    canonicalName: "Amazon",
    aliases: [
      { alias: "amazon", aliasType: "name" },
      { alias: "amazon.com", aliasType: "domain" },
    ],
  },
  {
    canonicalName: "Microsoft",
    aliases: [
      { alias: "microsoft", aliasType: "name" },
      { alias: "microsoft.com", aliasType: "domain" },
    ],
  },
  {
    canonicalName: "Apple",
    aliases: [
      { alias: "apple", aliasType: "name" },
      { alias: "apple.com", aliasType: "domain" },
    ],
  },
];
