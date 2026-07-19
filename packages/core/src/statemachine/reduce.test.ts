import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  ApplicationEventType,
  ApplicationState,
  EventType,
  type ReducerEventV1,
} from "@apptrack/shared";
import { reduce } from "./reduce.js";
import { orderEvents } from "./order.js";
import { applyCorrections } from "./apply-corrections.js";
import { REDUCER_VERSION } from "./version.js";

function ev(
  partial: Partial<ReducerEventV1> & {
    id: string;
    eventType: string;
    occurredAt: Date;
  },
): ReducerEventV1 {
  return {
    ingestedAt: partial.ingestedAt ?? partial.occurredAt,
    source: partial.source ?? "email",
    payload: partial.payload ?? {},
    ...partial,
  };
}

describe("reduce — transitions", () => {
  it("confirmation → confirmation_received", () => {
    const r = reduce([
      ev({
        id: "1",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
      }),
    ]);
    expect(r.state).toBe(ApplicationState.confirmation_received);
    expect(r.reducerVersion).toBe(REDUCER_VERSION);
  });

  it("OA invitation → assessment_received + actionRequired", () => {
    const r = reduce([
      ev({
        id: "1",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
      }),
      ev({
        id: "2",
        eventType: EventType.oa_invitation,
        occurredAt: new Date("2026-01-05T12:00:00Z"),
      }),
    ]);
    expect(r.state).toBe(ApplicationState.assessment_received);
    expect(r.actionRequired).toBe(true);
  });

  it("interview → interviewing; finalRound hint → final_round", () => {
    const base = [
      ev({
        id: "1",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
      }),
    ];
    const interviewing = reduce([
      ...base,
      ev({
        id: "2",
        eventType: EventType.interview_invitation,
        occurredAt: new Date("2026-01-10T12:00:00Z"),
      }),
    ]);
    expect(interviewing.state).toBe(ApplicationState.interviewing);

    const final = reduce([
      ...base,
      ev({
        id: "2",
        eventType: EventType.interview_scheduled,
        occurredAt: new Date("2026-01-10T12:00:00Z"),
        payload: { stage: "final round" },
      }),
    ]);
    expect(final.state).toBe(ApplicationState.final_round);
  });

  it("interview_cancelled falls back to prior stage", () => {
    const r = reduce([
      ev({
        id: "1",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
      }),
      ev({
        id: "2",
        eventType: EventType.interview_scheduled,
        occurredAt: new Date("2026-01-10T12:00:00Z"),
      }),
      ev({
        id: "3",
        eventType: EventType.interview_cancelled,
        occurredAt: new Date("2026-01-11T12:00:00Z"),
      }),
    ]);
    expect(r.state).toBe(ApplicationState.confirmation_received);
  });

  it("waitlist → on_hold", () => {
    const r = reduce([
      ev({
        id: "1",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
      }),
      ev({
        id: "2",
        eventType: EventType.waitlist_or_freeze,
        occurredAt: new Date("2026-01-08T12:00:00Z"),
      }),
    ]);
    expect(r.state).toBe(ApplicationState.on_hold);
    expect(r.flags.onHold).toBe(true);
  });

  it("reopen after rejection on recruiter outreach", () => {
    const r = reduce([
      ev({
        id: "1",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
      }),
      ev({
        id: "2",
        eventType: EventType.rejection,
        occurredAt: new Date("2026-01-15T12:00:00Z"),
      }),
      ev({
        id: "3",
        eventType: EventType.recruiter_outreach,
        occurredAt: new Date("2026-02-01T12:00:00Z"),
      }),
    ]);
    expect(r.state).toBe(ApplicationState.recruiter_screen);
    expect(r.flags.reopened).toBe(true);
  });

  it("flags conflict on same-day reject + interview (F14)", () => {
    const r = reduce([
      ev({
        id: "1",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
      }),
      ev({
        id: "2",
        eventType: EventType.rejection,
        occurredAt: new Date("2026-01-20T09:00:00Z"),
      }),
      ev({
        id: "3",
        eventType: EventType.interview_invitation,
        occurredAt: new Date("2026-01-20T15:00:00Z"),
      }),
    ]);
    expect(r.flags.conflict).toBe(true);
    // Both applied in order — last wins for state
    expect(r.state).toBe(ApplicationState.interviewing);
    expect(r.flags.reopened).toBe(true);
  });

  it("manual_override sets explicit state", () => {
    const r = reduce([
      ev({
        id: "1",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
      }),
      ev({
        id: "2",
        eventType: ApplicationEventType.manual_override,
        occurredAt: new Date("2026-01-02T12:00:00Z"),
        source: "user",
        payload: { state: ApplicationState.withdrawn },
      }),
    ]);
    expect(r.state).toBe(ApplicationState.withdrawn);
  });

  it("ignores superseded events", () => {
    const r = reduce([
      ev({
        id: "1",
        eventType: EventType.rejection,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
        supersededBy: "2",
      }),
      ev({
        id: "2",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
      }),
    ]);
    expect(r.state).toBe(ApplicationState.confirmation_received);
  });

  it("ghost_flagged → ghosted; cleared restores prior", () => {
    const r = reduce([
      ev({
        id: "1",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
      }),
      ev({
        id: "2",
        eventType: ApplicationEventType.ghost_flagged,
        occurredAt: new Date("2026-04-01T12:00:00Z"),
        source: "system",
      }),
      ev({
        id: "3",
        eventType: ApplicationEventType.ghost_cleared,
        occurredAt: new Date("2026-04-02T12:00:00Z"),
        source: "system",
      }),
    ]);
    expect(r.state).toBe(ApplicationState.confirmation_received);
  });

  it("ghost_flagged level=stale does not change current_state", () => {
    const r = reduce([
      ev({
        id: "1",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
      }),
      ev({
        id: "2",
        eventType: ApplicationEventType.ghost_flagged,
        occurredAt: new Date("2026-03-01T12:00:00Z"),
        source: "system",
        payload: { level: "stale" },
      }),
    ]);
    expect(r.state).toBe(ApplicationState.confirmation_received);
  });
});

describe("reduce — ordering & property", () => {
  it("out-of-order input matches sorted replay", () => {
    const events = [
      ev({
        id: "c",
        eventType: EventType.offer,
        occurredAt: new Date("2026-03-01T12:00:00Z"),
        ingestedAt: new Date("2026-03-10T12:00:00Z"),
      }),
      ev({
        id: "a",
        eventType: EventType.application_confirmation,
        occurredAt: new Date("2026-01-01T12:00:00Z"),
        ingestedAt: new Date("2026-01-02T12:00:00Z"),
      }),
      ev({
        id: "b",
        eventType: EventType.interview_scheduled,
        occurredAt: new Date("2026-02-01T12:00:00Z"),
        ingestedAt: new Date("2026-02-01T12:00:00Z"),
      }),
    ];
    const shuffled = reduce(events);
    const sorted = reduce(orderEvents(events));
    expect(shuffled.state).toBe(sorted.state);
    expect(shuffled.state).toBe(ApplicationState.offer);
  });

  it("any permutation ⇒ same final state when sorted (property)", () => {
    const types = [
      EventType.application_confirmation,
      EventType.oa_invitation,
      EventType.interview_invitation,
      EventType.rejection,
      EventType.offer,
      EventType.recruiter_outreach,
    ] as const;

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            eventType: fc.constantFrom(...types),
            day: fc.integer({ min: 1, max: 28 }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        (raw) => {
          const seen = new Set<string>();
          const events = raw
            .filter((e) => {
              if (seen.has(e.id)) return false;
              seen.add(e.id);
              return true;
            })
            .map((e, i) =>
              ev({
                id: e.id,
                eventType: e.eventType,
                occurredAt: new Date(
                  `2026-06-${String(e.day).padStart(2, "0")}T12:00:00Z`,
                ),
                ingestedAt: new Date(
                  `2026-06-${String(e.day).padStart(2, "0")}T${String(10 + (i % 10)).padStart(2, "0")}:00:00Z`,
                ),
              }),
            );
          if (events.length === 0) return;
          const a = reduce(events);
          const b = reduce([...events].reverse());
          expect(a.state).toBe(b.state);
          expect(a.flags.conflict).toBe(b.flags.conflict);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("never crashes on arbitrary event type strings", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 40 }), (eventType) => {
        const r = reduce([
          ev({
            id: "x",
            eventType,
            occurredAt: new Date("2026-01-01T00:00:00Z"),
          }),
        ]);
        expect(typeof r.state).toBe("string");
      }),
      { numRuns: 30 },
    );
  });
});

describe("applyCorrections stub (INV-7)", () => {
  it("user correction overlays machine state", () => {
    const out = applyCorrections({ currentState: "rejected", actionRequired: false }, [
      {
        field: "currentState",
        userValue: "interviewing",
        locked: true,
      },
    ]);
    expect(out.currentState).toBe("interviewing");
  });

  it("reverted corrections are ignored", () => {
    const out = applyCorrections({ currentState: "rejected", actionRequired: false }, [
      {
        field: "currentState",
        userValue: "offer",
        locked: false,
        revertedAt: new Date(),
      },
    ]);
    expect(out.currentState).toBe("rejected");
  });
});
