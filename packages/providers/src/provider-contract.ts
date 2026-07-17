/**
 * Shared EmailProvider contract tests. AGENTS.md §24.1
 * Any adapter must pass this suite via registerProviderContractTests().
 */
import { describe, expect, it } from "vitest";
import type { EmailProvider } from "./types.js";

export function registerProviderContractTests(
  name: string,
  createProvider: () => EmailProvider | Promise<EmailProvider>,
) {
  describe(`EmailProvider contract: ${name}`, () => {
    it("exposes capabilities", async () => {
      const p = await createProvider();
      expect(typeof p.capabilities.push).toBe("boolean");
      expect(typeof p.capabilities.threads).toBe("boolean");
      expect(typeof p.capabilities.historyCursor).toBe("boolean");
    });

    it("listHistorical yields refs and fetchMessage returns headers", async () => {
      const p = await createProvider();
      const after = new Date("2020-01-01T00:00:00Z");
      let refs = 0;
      for await (const batch of p.listHistorical({ afterDate: after })) {
        for (const ref of batch) {
          refs += 1;
          const msg = await p.fetchMessage(ref);
          expect(msg.providerMessageId).toBe(ref.providerMessageId);
          expect(msg.internalDate).toBeInstanceOf(Date);
          expect(typeof msg.headers).toBe("object");
          if (refs >= 3) break;
        }
        if (refs >= 3) break;
      }
      expect(refs).toBeGreaterThan(0);
    });

    it("listChanges is idempotent on re-poll with same advanced cursor", async () => {
      const p = await createProvider();
      let cursor = { historyId: "0" };
      for await (const batch of p.listChanges(cursor, { maxPages: 5 })) {
        if (batch.nextCursor) cursor = batch.nextCursor;
      }
      let secondAdded = 0;
      for await (const batch of p.listChanges(cursor, { maxPages: 1 })) {
        secondAdded += batch.added.length;
      }
      expect(secondAdded).toBe(0);
    });

    it("refreshAuth does not throw", async () => {
      const p = await createProvider();
      await expect(p.refreshAuth()).resolves.toBeUndefined();
    });
  });
}
