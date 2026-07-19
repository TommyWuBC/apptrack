import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { api } from "../api/client.js";
import { TimelineView } from "../components/TimelineView.js";
import { CorrectionsPanel } from "../components/CorrectionsPanel.js";

function ghostBadgeClass(status: string): string {
  if (status === "possibly_ghosted") return "badge badge-ghosted";
  if (status === "stale") return "badge badge-stale";
  if (status === "dismissed") return "badge";
  return "";
}

function ghostLabel(status: string): string | null {
  if (status === "possibly_ghosted") return "possibly ghosted";
  if (status === "stale") return "stale";
  if (status === "dismissed") return "ghost dismissed";
  return null;
}

export function ApplicationDetailPage() {
  const { id } = useParams({ from: "/applications/$id" });
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["application", id],
    queryFn: () => api.application(id),
  });
  const timeline = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => api.timeline(id),
  });

  const dismiss = useMutation({
    mutationFn: () => api.dismissGhost(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["application", id] });
      void qc.invalidateQueries({ queryKey: ["timeline", id] });
      void qc.invalidateQueries({ queryKey: ["applications"] });
      void qc.invalidateQueries({ queryKey: ["review"] });
    },
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
  const ghostStatus = timeline.data?.ghostStatus ?? app.ghostStatus;
  const label = ghostLabel(ghostStatus);
  const uncertain =
    ghostStatus === "stale" || ghostStatus === "possibly_ghosted";

  return (
    <div
      data-testid="application-detail"
      className={`space-y-8 ${uncertain ? "row-ghost-uncertain" : ""}`}
    >
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
        {label ? (
          <div className="mt-3 space-y-2" data-testid="ghost-banner">
            <span className={ghostBadgeClass(ghostStatus)} title="Inference only">
              {label}
            </span>
            <p className="text-sm text-ink-700">
              No recent activity — this is an inference, not a confirmed rejection.
              You can dismiss if you still expect a reply.
            </p>
            {ghostStatus !== "dismissed" ? (
              <button
                type="button"
                className="btn-ghost text-xs"
                data-testid="dismiss-ghost"
                disabled={dismiss.isPending}
                onClick={() => dismiss.mutate()}
              >
                Dismiss ghost flag
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <CorrectionsPanel applicationId={id} />

      {timeline.data ? <TimelineView timeline={timeline.data} /> : null}
    </div>
  );
}
