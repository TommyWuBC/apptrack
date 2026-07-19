import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "../api/client.js";

const PIPELINE_ORDER = [
  "applied",
  "confirmation_received",
  "assessment_received",
  "recruiter_screen",
  "interviewing",
  "final_round",
  "offer",
  "rejected",
  "withdrawn",
  "on_hold",
  "ghosted",
];

export function OverviewPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["applications"],
    queryFn: () => api.applications(),
  });

  if (isLoading) return <p className="text-sm text-ink-600">Loading pipeline…</p>;
  if (error) {
    return (
      <p className="text-sm text-red-700">
        {(error as Error).message}. Try{" "}
        <a href="?demo=1">demo mode</a>.
      </p>
    );
  }

  const apps = data?.applications ?? [];
  const byState = new Map<string, typeof apps>();
  for (const a of apps) {
    const list = byState.get(a.currentState) ?? [];
    list.push(a);
    byState.set(a.currentState, list);
  }
  const actionRequired = apps.filter((a) => a.actionRequired);
  const recent = [...apps].sort((a, b) => {
    const ta = a.lastEventAt ? Date.parse(a.lastEventAt) : 0;
    const tb = b.lastEventAt ? Date.parse(b.lastEventAt) : 0;
    return tb - ta;
  }).slice(0, 6);

  const columns = PIPELINE_ORDER.filter((s) => (byState.get(s)?.length ?? 0) > 0);
  for (const s of byState.keys()) {
    if (!columns.includes(s)) columns.push(s);
  }

  return (
    <div className="space-y-8" data-testid="overview-page">
      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">Pipeline</h2>
        <p className="mb-4 text-sm text-ink-600">
          Applications by derived state (event-sourced projection).
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((state) => (
            <div
              key={state}
              className="panel min-w-[11rem] flex-shrink-0 p-3"
              data-testid="pipeline-column"
            >
              <p className="mb-2 font-mono text-xs uppercase text-ink-600">
                {state}
              </p>
              <ul className="space-y-2">
                {(byState.get(state) ?? []).map((a) => (
                  <li key={a.id}>
                    <Link
                      to="/applications/$id"
                      params={{ id: a.id }}
                      className={`block text-sm font-medium text-ink-950 no-underline hover:text-moss-600 ${
                        a.ghostStatus === "stale" ||
                        a.ghostStatus === "possibly_ghosted"
                          ? "border-b border-dashed border-ink-900/40"
                          : ""
                      }`}
                    >
                      {a.companyName}
                      {a.ghostStatus === "possibly_ghosted"
                        ? " · possibly ghosted"
                        : a.ghostStatus === "stale"
                          ? " · stale"
                          : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">
          Action required
        </h2>
        {actionRequired.length === 0 ? (
          <p className="text-sm text-ink-600">Nothing urgent.</p>
        ) : (
          <ul className="space-y-2">
            {actionRequired.map((a) => (
              <li key={a.id} className="panel flex items-center justify-between p-3">
                <div>
                  <Link
                    to="/applications/$id"
                    params={{ id: a.id }}
                    className="font-medium no-underline"
                  >
                    {a.companyName}
                  </Link>
                  <p className="font-mono text-xs text-ink-600">{a.currentState}</p>
                </div>
                <span className="badge badge-action">action</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Recent changes</h2>
        <ul className="divide-y divide-ink-900/10 panel">
          {recent.map((a) => (
            <li key={a.id} className="flex justify-between px-3 py-2 text-sm">
              <Link
                to="/applications/$id"
                params={{ id: a.id }}
                className="no-underline"
              >
                {a.companyName}
              </Link>
              <span className="font-mono text-xs text-ink-600">
                {a.lastEventAt
                  ? new Date(a.lastEventAt).toLocaleDateString()
                  : "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
