import { useState } from "react";
import type { TimelineEvent, TimelineResponse } from "../api/client.js";
import { EvidenceViewer } from "./EvidenceViewer.js";

export function TimelineView({
  timeline,
}: {
  timeline: TimelineResponse;
}) {
  const [openEvidence, setOpenEvidence] = useState<string | null>(null);

  return (
    <div className="space-y-4" data-testid="timeline">
      <div className="panel flex flex-wrap gap-4 p-4">
        <div>
          <p className="text-xs uppercase text-ink-600">Current state</p>
          <p className="font-mono text-lg">{timeline.currentState}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-ink-600">Reducer</p>
          <p className="font-mono text-lg">
            {timeline.reduce.reducerVersion}
          </p>
        </div>
        {timeline.reduce.flags.conflict ? (
          <p className="badge badge-action self-center">conflict flagged</p>
        ) : null}
        {timeline.reduce.flags.reopened ? (
          <p className="badge self-center">reopened</p>
        ) : null}
      </div>

      <ol className="relative space-y-0 border-l border-ink-900/20 pl-6">
        {timeline.events.map((ev) => (
          <TimelineItem
            key={ev.id}
            event={ev}
            onEvidence={() =>
              ev.messageId ? setOpenEvidence(ev.messageId) : undefined
            }
          />
        ))}
        {timeline.events.length === 0 ? (
          <li className="text-sm text-ink-600">No events yet.</li>
        ) : null}
      </ol>

      {openEvidence ? (
        <EvidenceViewer
          messageId={openEvidence}
          onClose={() => setOpenEvidence(null)}
        />
      ) : null}
    </div>
  );
}

function TimelineItem({
  event,
  onEvidence,
}: {
  event: TimelineEvent;
  onEvidence: () => void;
}) {
  const [showHow, setShowHow] = useState(false);
  return (
    <li className="relative pb-6" data-testid="timeline-event">
      <span className="absolute -left-[1.65rem] top-1.5 h-2.5 w-2.5 rounded-full bg-citrus-400 ring-4 ring-parchment-50" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-ink-950">{event.eventType}</p>
        <time className="font-mono text-xs text-ink-600">
          {new Date(event.occurredAt).toLocaleString()}
        </time>
      </div>
      <p className="text-xs text-ink-600">source: {event.source}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={() => setShowHow((v) => !v)}
        >
          {showHow ? "Hide" : "How was this inferred?"}
        </button>
        {event.messageId ? (
          <button type="button" className="btn-ghost text-xs" onClick={onEvidence}>
            View email evidence
          </button>
        ) : null}
      </div>
      {showHow ? (
        <pre className="mt-2 overflow-x-auto rounded bg-ink-900 p-3 font-mono text-xs text-parchment-100">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      ) : null}
    </li>
  );
}
