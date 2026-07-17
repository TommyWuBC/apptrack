/**
 * Proactive token refresh for near-expiry credentials.
 * AGENTS.md §23 job `oauth.refresh-sweep` — callable from worker cron later.
 */
import { repos, type Database } from "@apptrack/db";
import type { ServerConfig } from "../config.js";
import { refreshGmailAccount } from "../services/gmail-oauth-service.js";

/** Refresh tokens expiring within `withinMs` (default 5 minutes). */
export async function oauthRefreshSweep(
  db: Database,
  config: ServerConfig,
  withinMs = 5 * 60 * 1000,
): Promise<{ refreshed: number; reauthRequired: number; errors: number }> {
  const cutoff = new Date(Date.now() + withinMs);
  const accountIds = await repos.oauthCredentialsRepo.listAccountIdsExpiringBefore(
    db,
    cutoff,
  );

  let refreshed = 0;
  let reauthRequired = 0;
  let errors = 0;
  for (const accountId of accountIds) {
    try {
      await refreshGmailAccount(db, config, accountId);
      refreshed += 1;
    } catch (err) {
      if ((err as { code?: string }).code === "REAUTH_REQUIRED") {
        reauthRequired += 1;
      } else {
        errors += 1;
      }
    }
  }
  return { refreshed, reauthRequired, errors };
}
