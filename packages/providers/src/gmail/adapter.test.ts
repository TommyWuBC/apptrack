import { afterEach, describe, expect, it } from "vitest";
import nock from "nock";
import { createGmailEmailProvider, HistoryExpiredError } from "./adapter.js";

const token = { getAccessToken: async () => "ya29.test" };

afterEach(() => {
  nock.cleanAll();
});

describe("GmailEmailProvider", () => {
  it("listChanges maps added/deleted and advances historyId", async () => {
    nock("https://gmail.googleapis.com")
      .get(/\/gmail\/v1\/users\/me\/history/)
      .query(true)
      .reply(200, {
        history: [
          {
            messagesAdded: [{ message: { id: "m1", threadId: "t1" } }],
            messagesDeleted: [{ message: { id: "m0" } }],
          },
        ],
        historyId: "999",
      });

    const p = createGmailEmailProvider({ tokens: token });
    const batches = [];
    for await (const b of p.listChanges({ historyId: "100" })) {
      batches.push(b);
    }
    expect(batches[0]?.added).toEqual([
      { providerMessageId: "m1", providerThreadId: "t1" },
    ]);
    expect(batches[0]?.deleted).toEqual(["m0"]);
    expect(batches[0]?.nextCursor?.historyId).toBe("999");
  });

  it("throws HistoryExpiredError on 404 history", async () => {
    nock("https://gmail.googleapis.com")
      .get(/\/gmail\/v1\/users\/me\/history/)
      .query(true)
      .reply(404, { error: { message: "notFound" } });

    const p = createGmailEmailProvider({ tokens: token });
    await expect(async () => {
      for await (const _ of p.listChanges({ historyId: "1" })) {
        // drain
      }
    }).rejects.toBeInstanceOf(HistoryExpiredError);
  });

  it("listHistorical paginates messages.list", async () => {
    nock("https://gmail.googleapis.com")
      .get(/\/gmail\/v1\/users\/me\/messages/)
      .query(true)
      .reply(200, {
        messages: [{ id: "a", threadId: "t" }],
        nextPageToken: "p2",
      })
      .get(/\/gmail\/v1\/users\/me\/messages/)
      .query(true)
      .reply(200, { messages: [{ id: "b", threadId: "t" }] });

    const p = createGmailEmailProvider({ tokens: token });
    const ids: string[] = [];
    for await (const batch of p.listHistorical({
      afterDate: new Date("2026-01-01"),
    })) {
      ids.push(...batch.map((r) => r.providerMessageId));
    }
    expect(ids).toEqual(["a", "b"]);
  });
});
