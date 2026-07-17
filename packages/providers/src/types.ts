/**
 * EmailProvider interface + adapters. AGENTS.md §11.1
 * googleapis may only be imported inside this package (R-2).
 */

export type SyncCursor = { historyId: string };

export type RawEmailRef = {
  providerMessageId: string;
  providerThreadId?: string;
};

export type RawEmail = {
  providerMessageId: string;
  providerThreadId?: string;
  internalDate: Date;
  headers: Record<string, string>;
  rawMime?: Buffer;
  subject?: string;
  fromAddress?: string;
  fromName?: string;
  toAddresses?: string[];
  snippet?: string;
  /** Structured body when MIME not available (Gmail format=full). */
  textPlain?: string;
  html?: string;
};

export type ChangeBatch = {
  added: RawEmailRef[];
  deleted: string[];
  nextCursor?: SyncCursor;
};

export type BackfillQuery = {
  afterDate: Date;
  beforeDate?: Date;
  query?: string;
};

export interface EmailProvider {
  listChanges(
    cursor: SyncCursor | null,
    opts: { maxPages?: number },
  ): AsyncIterable<ChangeBatch>;
  listHistorical(query: BackfillQuery): AsyncIterable<RawEmailRef[]>;
  fetchMessage(ref: RawEmailRef): Promise<RawEmail>;
  /** Optional: headers-only fetch for L0 prefilter (Gmail metadata). */
  fetchMetadata?(ref: RawEmailRef): Promise<RawEmail>;
  /** Current mailbox watermark (Gmail profile historyId / mock index). */
  getMailboxCursor?(): Promise<SyncCursor>;
  refreshAuth(): Promise<void>;
  readonly capabilities: {
    push: boolean;
    threads: boolean;
    historyCursor: boolean;
  };
}

export function providersHealth(): { ok: true; package: "providers" } {
  return { ok: true, package: "providers" };
}
