import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type TimelineEvent } from "../api/client.js";

export function ApplicationActions({
  applicationId,
  events,
}: {
  applicationId: string;
  events: TimelineEvent[];
}) {
  const queryClient = useQueryClient();
  const applications = useQuery({
    queryKey: ["applications"],
    queryFn: () => api.applications(),
  });
  const [targetId, setTargetId] = useState("");
  const [eventIds, setEventIds] = useState<string[]>([]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
    void queryClient.invalidateQueries({
      queryKey: ["application", applicationId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["timeline", applicationId],
    });
  };
  const merge = useMutation({
    mutationFn: () => api.mergeApplications(targetId, [applicationId]),
    onSuccess: () => window.location.assign(`/applications/${targetId}`),
  });
  const split = useMutation({
    mutationFn: () => api.splitApplication(applicationId, eventIds),
    onSuccess: refresh,
  });
  const reattach = useMutation({
    mutationFn: () =>
      api.reattachEvent(applicationId, eventIds[0]!, targetId),
    onSuccess: refresh,
  });

  const targets = (applications.data?.applications ?? []).filter(
    (application) => application.id !== applicationId,
  );
  const toggle = (eventId: string) => {
    setEventIds((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId],
    );
  };

  return (
    <section className="panel space-y-3 p-4">
      <div>
        <h3 className="font-medium">Merge, split, or reattach</h3>
        <p className="text-xs text-ink-600">
          These operations append audit events; timeline history is never
          deleted.
        </p>
      </div>
      <label className="block text-sm">
        Target application
        <select
          className="input mt-1 w-full max-w-md"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
        >
          <option value="">Choose an application…</option>
          {targets.map((application) => (
            <option key={application.id} value={application.id}>
              {application.companyName} · {application.currentState} ·{" "}
              {application.id}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="max-h-40 overflow-y-auto rounded border border-ink-900/10 p-2">
        <legend className="px-1 text-xs text-ink-600">Timeline events</legend>
        {events.map((event) => (
          <label key={event.id} className="block text-xs">
            <input
              type="checkbox"
              checked={eventIds.includes(event.id)}
              onChange={() => toggle(event.id)}
            />{" "}
            {event.eventType} · {new Date(event.occurredAt).toLocaleString()}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost text-xs"
          disabled={!targetId || merge.isPending}
          onClick={() => merge.mutate()}
        >
          Merge current into target
        </button>
        <button
          type="button"
          className="btn-ghost text-xs"
          disabled={eventIds.length === 0 || split.isPending}
          onClick={() => split.mutate()}
        >
          Split selected events
        </button>
        <button
          type="button"
          className="btn-ghost text-xs"
          disabled={
            !targetId || eventIds.length !== 1 || reattach.isPending
          }
          onClick={() => reattach.mutate()}
        >
          Reattach selected event
        </button>
      </div>
    </section>
  );
}
