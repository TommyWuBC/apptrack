import { describe, expect, it } from "vitest";
import {
  activeCorrections,
  applyCorrections,
  isFieldLocked,
} from "./apply-corrections.js";

describe("applyCorrections INV-7", () => {
  it("user correction overlays machine state", () => {
    const out = applyCorrections(
      { currentState: "rejected", actionRequired: false },
      [
        {
          field: "currentState",
          userValue: "interviewing",
          locked: true,
        },
      ],
    );
    expect(out.currentState).toBe("interviewing");
  });

  it("reverted corrections are ignored", () => {
    const out = applyCorrections(
      { currentState: "rejected", actionRequired: false },
      [
        {
          field: "currentState",
          userValue: "offer",
          locked: false,
          revertedAt: new Date(),
        },
      ],
    );
    expect(out.currentState).toBe("rejected");
  });

  it("adversarial: reprocess machine state does not overwrite lock", () => {
    const corrections = [
      {
        id: "c1",
        field: "currentState",
        userValue: "interviewing",
        locked: true,
        createdAt: new Date("2026-01-01"),
      },
    ];
    expect(isFieldLocked(corrections, "currentState")).toBe(true);

    const machineAfterReprocess = {
      currentState: "rejected",
      actionRequired: false,
    };
    const out = applyCorrections(machineAfterReprocess, corrections);
    expect(out.currentState).toBe("interviewing");
  });

  it("undo latest falls back to prior correction", () => {
    const timeline = [
      {
        field: "currentState",
        userValue: "offer",
        locked: false,
        createdAt: new Date("2026-01-01"),
      },
      {
        field: "currentState",
        userValue: "withdrawn",
        locked: true,
        createdAt: new Date("2026-01-02"),
        revertedAt: new Date("2026-01-03"),
      },
    ];
    const active = activeCorrections(timeline);
    expect(active).toHaveLength(1);
    expect(active[0]!.userValue).toBe("offer");
    expect(
      applyCorrections(
        { currentState: "rejected", actionRequired: false },
        timeline,
      ).currentState,
    ).toBe("offer");
  });
});
