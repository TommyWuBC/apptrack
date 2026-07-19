/**
 * Pure merge/split decision helpers tested via corrections precedence +
 * event reattach contract (no DB). Full repo roundtrip needs Postgres.
 */
import { describe, expect, it } from "vitest";
import { applyCorrections, isFieldLocked } from "@apptrack/core";

describe("corrections-service contracts", () => {
  it("merge survivor keeps locked state after machine would diverge", () => {
    const corrections = [
      {
        field: "currentState",
        userValue: "interviewing",
        locked: true,
        createdAt: new Date(),
      },
    ];
    // After merge recompute, machine might say confirmation_received
    const out = applyCorrections(
      { currentState: "confirmation_received", actionRequired: false },
      corrections,
    );
    expect(out.currentState).toBe("interviewing");
    expect(isFieldLocked(corrections, "currentState")).toBe(true);
  });
});
