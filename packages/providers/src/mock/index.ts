/**
 * Mock EmailProvider — replays synthetic fixtures. AGENTS.md §11.1 / M5
 * Contributors never need a real Gmail account.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  BackfillQuery,
  ChangeBatch,
  EmailProvider,
  RawEmail,
  RawEmailRef,
  SyncCursor,
} from "../types.js";

export type MockFixtureMessage = {
  providerMessageId: string;
  providerThreadId: string;
  internalDate: Date;
  fromAddress: string;
  fromName?: string;
  subject: string;
  snippet: string;
  headers: Record<string, string>;
  rawMime: Buffer;
};

function walkEmlFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkEmlFiles(p, out);
    else if (name.endsWith(".eml")) out.push(p);
  }
  return out;
}

/** Minimal header parse from .eml (enough for mock sync; full MIME is M6). */
export function parseEmlLite(raw: Buffer, filePath: string): MockFixtureMessage {
  const text = raw.toString("utf8");
  const headerEnd = text.search(/\r?\n\r?\n/);
  const headerBlock = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
  const get = (name: string): string | undefined => {
    const re = new RegExp(`^${name}:\\s*(.+)$`, "im");
    const m = headerBlock.match(re);
    return m?.[1]?.trim();
  };
  const from = get("From") ?? "unknown@example.com";
  const fromMatch = from.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?$/);
  const fromName = fromMatch?.[1]?.trim() || undefined;
  const fromAddress = (fromMatch?.[2] ?? from).trim();
  const subject = get("Subject") ?? "(no subject)";
  const messageId =
    get("Message-ID")?.replace(/^<|>$/g, "") ??
    `mock-${Buffer.from(filePath).toString("hex").slice(0, 24)}`;
  const dateHdr = get("Date");
  const internalDate = dateHdr ? new Date(dateHdr) : new Date();
  const slug = filePath.replace(/\\/g, "/").split("/").slice(-3).join("/");

  return {
    providerMessageId: messageId,
    providerThreadId: `thread-${slug}`,
    internalDate: Number.isNaN(internalDate.getTime())
      ? new Date()
      : internalDate,
    fromAddress,
    fromName,
    subject,
    snippet: subject.slice(0, 120),
    headers: {
      From: from,
      Subject: subject,
      "Message-ID": messageId,
      ...(get("List-Id") ? { "List-Id": get("List-Id")! } : {}),
      ...(get("List-Unsubscribe")
        ? { "List-Unsubscribe": get("List-Unsubscribe")! }
        : {}),
    },
    rawMime: raw,
  };
}

export function loadFixturesFromDir(fixturesRoot: string): MockFixtureMessage[] {
  const emailsDir = join(fixturesRoot, "emails");
  const files = walkEmlFiles(emailsDir);
  return files
    .map((f) => parseEmlLite(readFileSync(f), f))
    .sort((a, b) => a.internalDate.getTime() - b.internalDate.getTime());
}

export type MockEmailProviderOpts = {
  fixturesRoot: string;
  /** When set, listChanges returns these as "new" once then empty. */
  messages?: MockFixtureMessage[];
};

/**
 * In-memory Gmail-like provider over fixture corpus.
 * Cursor is an index into the message list (`historyId` = stringified index).
 */
export class MockEmailProvider implements EmailProvider {
  readonly capabilities = {
    push: false,
    threads: true,
    historyCursor: true,
  } as const;

  private readonly messages: MockFixtureMessage[];
  private deleted: Set<string> = new Set();

  constructor(opts: MockEmailProviderOpts) {
    this.messages = opts.messages ?? loadFixturesFromDir(opts.fixturesRoot);
  }

  /** Test helper: mark a message deleted at provider. */
  simulateDeletion(providerMessageId: string): void {
    this.deleted.add(providerMessageId);
  }

  async refreshAuth(): Promise<void> {
    // no-op for mock
  }

  async getMailboxCursor(): Promise<SyncCursor> {
    return { historyId: String(this.messages.length) };
  }

  async fetchMetadata(ref: RawEmailRef): Promise<RawEmail> {
    return this.fetchMessage(ref);
  }

  async *listChanges(
    cursor: SyncCursor | null,
    opts: { maxPages?: number } = {},
  ): AsyncIterable<ChangeBatch> {
    const start = cursor?.historyId ? Number.parseInt(cursor.historyId, 10) : 0;
    const idx = Number.isFinite(start) ? start : 0;
    const maxPages = opts.maxPages ?? 1;
    const pageSize = 50;
    let page = 0;
    let i = idx;
    while (page < maxPages && i < this.messages.length) {
      const slice = this.messages.slice(i, i + pageSize);
      i += slice.length;
      page += 1;
      const added: RawEmailRef[] = slice
        .filter((m) => !this.deleted.has(m.providerMessageId))
        .map((m) => ({
          providerMessageId: m.providerMessageId,
          providerThreadId: m.providerThreadId,
        }));
      const deleted = [...this.deleted].filter((id) =>
        slice.some((m) => m.providerMessageId === id),
      );
      yield {
        added,
        deleted,
        nextCursor: { historyId: String(i) },
      };
    }
    if (page === 0) {
      yield {
        added: [],
        deleted: [],
        nextCursor: { historyId: String(i) },
      };
    }
  }

  async *listHistorical(
    query: BackfillQuery,
  ): AsyncIterable<RawEmailRef[]> {
    const after = query.afterDate.getTime();
    const before = query.beforeDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const matched = this.messages.filter((m) => {
      const t = m.internalDate.getTime();
      return t >= after && t <= before;
    });
    const pageSize = 50;
    for (let i = 0; i < matched.length; i += pageSize) {
      yield matched.slice(i, i + pageSize).map((m) => ({
        providerMessageId: m.providerMessageId,
        providerThreadId: m.providerThreadId,
      }));
    }
  }

  async fetchMessage(ref: RawEmailRef): Promise<RawEmail> {
    const m = this.messages.find(
      (x) => x.providerMessageId === ref.providerMessageId,
    );
    if (!m) {
      throw Object.assign(new Error("not_found"), { status: 404 });
    }
    return {
      providerMessageId: m.providerMessageId,
      providerThreadId: m.providerThreadId,
      internalDate: m.internalDate,
      headers: m.headers,
      rawMime: m.rawMime,
      subject: m.subject,
      fromAddress: m.fromAddress,
      fromName: m.fromName,
      toAddresses: ["alex.rivera@example.com"],
      snippet: m.snippet,
    };
  }
}

export function createMockEmailProvider(
  fixturesRoot: string,
): MockEmailProvider {
  return new MockEmailProvider({ fixturesRoot });
}
