/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TimelineView } from "./TimelineView.js";
import type { TimelineResponse } from "../api/client.js";

const sample: TimelineResponse = {
  applicationId: "app-1",
  currentState: "interviewing",
  stateVersion: "state-v1",
  actionRequired: true,
  ghostStatus: "none",
  appliedAt: "2026-05-01T12:00:00.000Z",
  lastEventAt: "2026-06-10T15:00:00.000Z",
  reduce: {
    state: "interviewing",
    stateTimeline: [],
    actionRequired: true,
    flags: { conflict: false, reopened: false, onHold: false },
    reducerVersion: "state-v1",
  },
  events: [
    {
      id: "ev-1",
      eventType: "application_confirmation",
      occurredAt: "2026-05-01T12:00:00.000Z",
      ingestedAt: "2026-05-01T12:05:00.000Z",
      source: "email",
      messageId: "msg-1",
      classificationResultId: null,
      payload: { note: "demo" },
      supersededBy: null,
    },
  ],
};

describe("TimelineView", () => {
  it("renders events and evidence affordance", () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TimelineView timeline={sample} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("timeline")).toBeInTheDocument();
    expect(screen.getByText("application_confirmation")).toBeInTheDocument();
    expect(screen.getByText("View email evidence")).toBeInTheDocument();
    expect(screen.getByText("How was this inferred?")).toBeInTheDocument();
  });
});
