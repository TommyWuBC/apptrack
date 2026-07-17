/**
 * Gmail EmailProvider via REST + fetch (googleapis not required for M5).
 * AGENTS.md §11.3 — history.list, messages.list, messages.get.
 */
import { withBackoff } from "../http-backoff.js";
import type {
  BackfillQuery,
  ChangeBatch,
  EmailProvider,
  RawEmail,
  RawEmailRef,
  SyncCursor,
} from "../types.js";

export type GmailAccessTokenProvider = {
  getAccessToken: () => Promise<string>;
};

export type GmailEmailProviderOpts = {
  tokens: GmailAccessTokenProvider;
  fetchImpl?: typeof fetch;
  userId?: string;
};

type GmailHeader = { name: string; value: string };

function headersToRecord(
  headers: GmailHeader[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers ?? []) {
    out[h.name] = h.value;
  }
  return out;
}

function pickHeader(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  return key ? headers[key] : undefined;
}

function parseFrom(from: string): { address: string; name?: string } {
  const fromMatch = from.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?$/);
  return {
    address: fromMatch?.[2] ?? from,
    name: fromMatch?.[1]?.trim() || undefined,
  };
}

export class HistoryExpiredError extends Error {
  readonly code = "HISTORY_EXPIRED";
  readonly status = 404;
  constructor(message = "gmail historyId expired") {
    super(message);
    this.name = "HistoryExpiredError";
  }
}

export class GmailEmailProvider implements EmailProvider {
  readonly capabilities = {
    push: false,
    threads: true,
    historyCursor: true,
  } as const;

  private readonly tokens: GmailAccessTokenProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly user: string;

  constructor(opts: GmailEmailProviderOpts) {
    this.tokens = opts.tokens;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.user = opts.userId ?? "me";
  }

  private base(): string {
    return `https://gmail.googleapis.com/gmail/v1/users/${this.user}`;
  }

  async refreshAuth(): Promise<void> {
    await this.tokens.getAccessToken();
  }

  async getMailboxCursor(): Promise<SyncCursor> {
    const { json } = await this.api<{ historyId: string }>("/profile");
    return { historyId: json.historyId };
  }

  private async api<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<{ status: number; json: T }> {
    return withBackoff(async () => {
      const token = await this.tokens.getAccessToken();
      const url = `${this.base()}${path}`;
      const res = await this.fetchImpl(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) {
        if (res.status === 404 && path.startsWith("/history")) {
          throw new HistoryExpiredError();
        }
        const body = await res.text();
        throw Object.assign(new Error(`gmail_api_${res.status}: ${body}`), {
          status: res.status,
        });
      }
      return { status: res.status, json: (await res.json()) as T };
    });
  }

  async *listChanges(
    cursor: SyncCursor | null,
    opts: { maxPages?: number } = {},
  ): AsyncIterable<ChangeBatch> {
    if (!cursor?.historyId) {
      yield { added: [], deleted: [], nextCursor: undefined };
      return;
    }
    const maxPages = opts.maxPages ?? 10;
    let pageToken: string | undefined;
    let page = 0;
    let latestHistoryId = cursor.historyId;
    const startId = cursor.historyId;

    while (page < maxPages) {
      let path =
        `/history?startHistoryId=${encodeURIComponent(startId)}` +
        `&historyTypes=messageAdded&historyTypes=messageDeleted`;
      if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;

      const { json } = await this.api<{
        history?: Array<{
          messagesAdded?: Array<{
            message: { id: string; threadId?: string };
          }>;
          messagesDeleted?: Array<{ message: { id: string } }>;
        }>;
        historyId?: string;
        nextPageToken?: string;
      }>(path);

      const added: RawEmailRef[] = [];
      const deleted: string[] = [];
      for (const h of json.history ?? []) {
        for (const a of h.messagesAdded ?? []) {
          added.push({
            providerMessageId: a.message.id,
            providerThreadId: a.message.threadId,
          });
        }
        for (const d of h.messagesDeleted ?? []) {
          deleted.push(d.message.id);
        }
      }
      if (json.historyId) latestHistoryId = json.historyId;
      yield {
        added,
        deleted,
        nextCursor: { historyId: latestHistoryId },
      };
      pageToken = json.nextPageToken;
      page += 1;
      if (!pageToken) break;
    }
  }

  async *listHistorical(query: BackfillQuery): AsyncIterable<RawEmailRef[]> {
    const after = formatGmailDate(query.afterDate);
    const before = query.beforeDate
      ? formatGmailDate(query.beforeDate)
      : undefined;
    const qParts = [
      `after:${after}`,
      before ? `before:${before}` : null,
      query.query ??
        "(category:primary OR from:greenhouse.io OR from:lever.co OR from:ashbyhq.com OR from:myworkday.com OR from:smartrecruiters.com OR from:icims.com)",
    ].filter(Boolean);
    const q = qParts.join(" ");

    let pageToken: string | undefined;
    do {
      let path = `/messages?q=${encodeURIComponent(q)}&maxResults=100`;
      if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
      const { json } = await this.api<{
        messages?: Array<{ id: string; threadId?: string }>;
        nextPageToken?: string;
      }>(path);
      const batch = (json.messages ?? []).map((m) => ({
        providerMessageId: m.id,
        providerThreadId: m.threadId,
      }));
      if (batch.length) yield batch;
      pageToken = json.nextPageToken;
    } while (pageToken);
  }

  async fetchMessage(ref: RawEmailRef): Promise<RawEmail> {
    const { json } = await this.api<{
      id: string;
      threadId?: string;
      internalDate?: string;
      snippet?: string;
      payload?: { headers?: GmailHeader[] };
    }>(`/messages/${encodeURIComponent(ref.providerMessageId)}?format=full`);

    const headers = headersToRecord(json.payload?.headers);
    const from = parseFrom(pickHeader(headers, "From") ?? "");
    const to = pickHeader(headers, "To");
    return {
      providerMessageId: json.id,
      providerThreadId: json.threadId,
      internalDate: new Date(
        json.internalDate ? Number.parseInt(json.internalDate, 10) : Date.now(),
      ),
      headers,
      subject: pickHeader(headers, "Subject"),
      fromAddress: from.address,
      fromName: from.name,
      toAddresses: to ? [to] : [],
      snippet: json.snippet,
    };
  }

  async fetchMetadata(ref: RawEmailRef): Promise<RawEmail> {
    const { json } = await this.api<{
      id: string;
      threadId?: string;
      internalDate?: string;
      snippet?: string;
      payload?: { headers?: GmailHeader[] };
    }>(
      `/messages/${encodeURIComponent(ref.providerMessageId)}?format=metadata` +
        `&metadataHeaders=From&metadataHeaders=Subject` +
        `&metadataHeaders=List-Id&metadataHeaders=List-Unsubscribe`,
    );
    const headers = headersToRecord(json.payload?.headers);
    const from = parseFrom(pickHeader(headers, "From") ?? "");
    return {
      providerMessageId: json.id,
      providerThreadId: json.threadId,
      internalDate: new Date(
        json.internalDate ? Number.parseInt(json.internalDate, 10) : Date.now(),
      ),
      headers,
      subject: pickHeader(headers, "Subject"),
      fromAddress: from.address,
      fromName: from.name,
      snippet: json.snippet,
    };
  }
}

function formatGmailDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export function createGmailEmailProvider(
  opts: GmailEmailProviderOpts,
): GmailEmailProvider {
  return new GmailEmailProvider(opts);
}
