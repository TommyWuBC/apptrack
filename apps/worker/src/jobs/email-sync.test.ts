import { describe, expect, it, vi, afterEach } from "vitest";
import { triggerSyncRun } from "./email-sync.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("email.sync poller", () => {
  it("POSTs /api/v1/sync/run", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: { inserted: 0 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const body = await triggerSyncRun();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/sync/run"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(body).toEqual({ result: { inserted: 0 } });
  });
});
