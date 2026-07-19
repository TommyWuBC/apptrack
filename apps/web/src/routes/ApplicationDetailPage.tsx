import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { api } from "../api/client.js";
import { TimelineView } from "../components/TimelineView.js";
import { CorrectionsPanel } from "../components/CorrectionsPanel.js";

export function ApplicationDetailPage() {
  const { id } = useParams({ from: "/applications/$id" });
  const detail = useQuery({
    queryKey: ["application", id],
    queryFn: () => api.application(id),
  });
  const timeline = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => api.timeline(id),
  });

  if (detail.isLoading || timeline.isLoading) {
    return <p className="text-sm text-ink-600">Loading timeline…</p>;
  }
  if (detail.error || timeline.error) {
    return (
      <p className="text-sm text-red-700">
        {(detail.error as Error)?.message ??
          (timeline.error as Error)?.message}
      </p>
    );
  }

  const app = detail.data!.application;
  const company = detail.data!.company;

  return (
    <div data-testid="application-detail" className="space-y-8">
      <div>
        <p className="mb-2">
          <Link to="/applications" className="text-sm">
            ← Applications
          </Link>
        </p>
        <h2 className="font-display text-2xl font-semibold">
          {company?.canonicalName ?? app.companyId}
        </h2>
        <p className="font-mono text-sm text-ink-600">
          {timeline.data?.currentState ?? app.currentState}
          {app.actionRequired ? " · action required" : ""}
        </p>
      </div>

      <CorrectionsPanel applicationId={id} />

      {timeline.data ? <TimelineView timeline={timeline.data} /> : null}
    </div>
  );
}
