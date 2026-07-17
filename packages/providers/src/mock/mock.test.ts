import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createMockEmailProvider } from "./index.js";
import { registerProviderContractTests } from "../provider-contract.js";

const fixturesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures",
);

registerProviderContractTests("mock", () =>
  createMockEmailProvider(fixturesRoot),
);

describe("MockEmailProvider extras", () => {
  it("loads fixtures and reports tombstone candidates on simulateDeletion", async () => {
    const p = createMockEmailProvider(fixturesRoot);
    const first = await p.fetchMessage({
      providerMessageId: (
        await (async () => {
          for await (const batch of p.listHistorical({
            afterDate: new Date("2020-01-01"),
          })) {
            return batch[0]!;
          }
          throw new Error("empty");
        })()
      ).providerMessageId,
    });
    expect(first.subject).toBeTruthy();
    p.simulateDeletion(first.providerMessageId);
    expect(p.capabilities.historyCursor).toBe(true);
  });
});
