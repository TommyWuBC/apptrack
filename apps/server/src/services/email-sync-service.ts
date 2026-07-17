/**
 * Email sync / backfill orchestration. AGENTS.md §11.3–11.4 / M5
 * Idempotent inserts (INV-2); history-expired fallback (F1); reauth via caller (F3).
 */
import { prefilterEmail } from "@apptrack/core";
import { repos, type Database } from "@apptrack/db";
import {
  HistoryExpiredError,
  type EmailProvider,
  type RawEmail,
  type RawEmailRef,
  type SyncCursor,
} from "@apptrack/providers";
import { normalizeAndStoreFromRaw } from "./email-normalize-service.js";
import { classifyAndStoreMessage } from "./email-classify-service.js";

const { accountsRepo, emailsRepo } = repos;

export type SyncResult = {
  accountId: string;
  mode: "incremental" | "backfill" | "history_fallback";
  inserted: number;
  skippedPrefilter: number;
  tombstoned: number;
  normalizeQueued: string[];
  cursor: string | null;
};

export type BackfillResult = SyncResult & {
  pages: number;
  done: boolean;
};

async function loadMeta(
  provider: EmailProvider,
  ref: RawEmailRef,
): Promise<RawEmail> {
  if (provider.fetchMetadata) return provider.fetchMetadata(ref);
  return provider.fetchMessage(ref);
}

async function ingestRef(
  db: Database,
  accountId: string,
  provider: EmailProvider,
  ref: RawEmailRef,
  counters: { inserted: number; skippedPrefilter: number },
  normalizeQueued: string[],
): Promise<void> {
  const meta = await loadMeta(provider, ref);
  const decision = prefilterEmail({
    fromAddress: meta.fromAddress,
    listId: meta.headers["List-Id"] ?? meta.headers["list-id"],
    listUnsubscribe:
      meta.headers["List-Unsubscribe"] ?? meta.headers["list-unsubscribe"],
    subject: meta.subject,
  });

  if (decision.action === "skip") {
    counters.skippedPrefilter += 1;
    return;
  }

  const full =
    provider.fetchMetadata && decision.action === "fetch"
      ? await provider.fetchMessage(ref)
      : meta;

  const { row, inserted } = await emailsRepo.insertEmailMessageIdempotent(db, {
    accountId,
    providerMessageId: full.providerMessageId,
    providerThreadId: full.providerThreadId,
    internalDate: full.internalDate,
    fromAddress: full.fromAddress,
    fromName: full.fromName,
    toAddresses: full.toAddresses,
    subject: full.subject,
    snippet: full.snippet,
    headersSubset: full.headers,
  });

  if (inserted) {
    counters.inserted += 1;
    normalizeQueued.push(row.id);
    try {
      await normalizeAndStoreFromRaw(db, row.id, full);
      await classifyAndStoreMessage(db, row.id);
    } catch {
      // Normalize/classify failure must not roll back ingest; re-run via API
    }
  }
}

/**
 * Incremental sync. If sync_cursor is null → bounded backfill first.
 * On HistoryExpiredError → re-list since lastSync−7d (F1).
 */
export async function runEmailSync(
  db: Database,
  provider: EmailProvider,
  accountId: string,
): Promise<SyncResult> {
  const account = await accountsRepo.getAccountById(db, accountId);
  if (!account) throw new Error("account_not_found");
  if (account.status !== "active") {
    throw Object.assign(new Error(`account_status_${account.status}`), {
      code: account.status === "reauth_required" ? "REAUTH_REQUIRED" : "INACTIVE",
    });
  }

  await provider.refreshAuth();

  if (!account.syncCursor) {
    const after = new Date();
    after.setUTCDate(after.getUTCDate() - 180);
    const bf = await runEmailBackfill(db, provider, accountId, {
      afterDate: after,
      maxMessages: 500,
    });
    return { ...bf, mode: "backfill" };
  }

  const counters = { inserted: 0, skippedPrefilter: 0 };
  const normalizeQueued: string[] = [];
  let tombstoned = 0;
  let cursor: SyncCursor = { historyId: account.syncCursor };
  let mode: SyncResult["mode"] = "incremental";

  try {
    for await (const batch of provider.listChanges(cursor, { maxPages: 10 })) {
      for (const ref of batch.added) {
        await ingestRef(
          db,
          accountId,
          provider,
          ref,
          counters,
          normalizeQueued,
        );
      }
      for (const delId of batch.deleted) {
        await emailsRepo.tombstoneProviderDeletion(db, accountId, delId);
        tombstoned += 1;
      }
      if (batch.nextCursor) cursor = batch.nextCursor;
    }
  } catch (err) {
    if (err instanceof HistoryExpiredError) {
      mode = "history_fallback";
      const since = new Date(
        (account.lastSyncAt ?? new Date()).getTime() - 7 * 24 * 60 * 60 * 1000,
      );
      for await (const batch of provider.listHistorical({ afterDate: since })) {
        for (const ref of batch) {
          await ingestRef(
            db,
            accountId,
            provider,
            ref,
            counters,
            normalizeQueued,
          );
        }
      }
      if (provider.getMailboxCursor) {
        cursor = await provider.getMailboxCursor();
      }
    } else {
      throw err;
    }
  }

  await accountsRepo.updateSyncCursor(db, accountId, cursor.historyId);

  return {
    accountId,
    mode,
    inserted: counters.inserted,
    skippedPrefilter: counters.skippedPrefilter,
    tombstoned,
    normalizeQueued,
    cursor: cursor.historyId,
  };
}

export async function runEmailBackfill(
  db: Database,
  provider: EmailProvider,
  accountId: string,
  opts: { afterDate: Date; beforeDate?: Date; maxMessages?: number },
): Promise<BackfillResult> {
  const account = await accountsRepo.getAccountById(db, accountId);
  if (!account) throw new Error("account_not_found");
  if (account.status !== "active") {
    throw Object.assign(new Error(`account_status_${account.status}`), {
      code: account.status === "reauth_required" ? "REAUTH_REQUIRED" : "INACTIVE",
    });
  }

  await provider.refreshAuth();

  const maxMessages = opts.maxMessages ?? 500;
  const counters = { inserted: 0, skippedPrefilter: 0 };
  const normalizeQueued: string[] = [];
  let pages = 0;
  let processed = 0;

  for await (const batch of provider.listHistorical({
    afterDate: opts.afterDate,
    beforeDate: opts.beforeDate,
  })) {
    pages += 1;
    for (const ref of batch) {
      if (processed >= maxMessages) break;
      await ingestRef(db, accountId, provider, ref, counters, normalizeQueued);
      processed += 1;
    }
    if (processed >= maxMessages) break;
  }

  const done = processed < maxMessages;
  let cursor: string | null = account.syncCursor;
  if (done && provider.getMailboxCursor) {
    const c = await provider.getMailboxCursor();
    cursor = c.historyId;
    await accountsRepo.updateSyncCursor(db, accountId, cursor);
  }

  await accountsRepo.updateBackfillState(db, accountId, {
    afterDate: opts.afterDate.toISOString(),
    beforeDate: opts.beforeDate?.toISOString() ?? null,
    processed,
    pages,
    done,
    updatedAt: new Date().toISOString(),
  });

  return {
    accountId,
    mode: "backfill",
    inserted: counters.inserted,
    skippedPrefilter: counters.skippedPrefilter,
    tombstoned: 0,
    normalizeQueued,
    cursor,
    pages,
    done,
  };
}

export async function getSyncStatus(db: Database, accountId: string) {
  const account = await accountsRepo.getAccountById(db, accountId);
  if (!account) return null;
  return {
    accountId: account.id,
    status: account.status,
    lastSyncAt: account.lastSyncAt,
    syncCursor: account.syncCursor,
    backfillState: account.backfillState,
  };
}
