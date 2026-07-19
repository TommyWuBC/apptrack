import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "../api/client.js";

export function ApplicationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["applications"],
    queryFn: () => api.applications(),
  });
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [sort, setSort] = useState<"recent" | "company" | "state">("recent");

  const rows = useMemo(() => {
    let list = data?.applications ?? [];
    if (stateFilter !== "all") {
      list = list.filter((a) => a.currentState === stateFilter);
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (a) =>
          a.companyName.toLowerCase().includes(needle) ||
          (a.source ?? "").toLowerCase().includes(needle) ||
          a.currentState.includes(needle),
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === "company") return a.companyName.localeCompare(b.companyName);
      if (sort === "state") return a.currentState.localeCompare(b.currentState);
      const ta = a.lastEventAt ? Date.parse(a.lastEventAt) : 0;
      const tb = b.lastEventAt ? Date.parse(b.lastEventAt) : 0;
      return tb - ta;
    });
    return list;
  }, [data, q, stateFilter, sort]);

  const states = [
    "all",
    ...new Set((data?.applications ?? []).map((a) => a.currentState)),
  ];

  if (isLoading) return <p className="text-sm text-ink-600">Loading…</p>;
  if (error) {
    return <p className="text-sm text-red-700">{(error as Error).message}</p>;
  }

  return (
    <div data-testid="applications-page">
      <h2 className="mb-1 font-display text-xl font-semibold">Applications</h2>
      <p className="mb-4 text-sm text-ink-600">
        Search, filter by state, sort. Detail opens the event timeline.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search company, source, state…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search applications"
        />
        <select
          className="input max-w-[12rem]"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          aria-label="Filter by state"
        >
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[10rem]"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Sort"
        >
          <option value="recent">Recent</option>
          <option value="company">Company</option>
          <option value="state">State</option>
        </select>
      </div>
      <div className="table-wrap panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>State</th>
              <th>Source</th>
              <th>Last event</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr
                key={a.id}
                className={
                  a.ghostStatus === "stale" ||
                  a.ghostStatus === "possibly_ghosted"
                    ? "row-ghost-uncertain"
                    : undefined
                }
              >
                <td className="font-medium">{a.companyName}</td>
                <td>
                  <span className="badge">{a.currentState}</span>
                  {a.actionRequired ? (
                    <span className="badge badge-action ml-1">action</span>
                  ) : null}
                  {a.ghostStatus === "stale" ? (
                    <span
                      className="badge badge-stale ml-1"
                      title="No activity for a while — inference"
                    >
                      stale
                    </span>
                  ) : null}
                  {a.ghostStatus === "possibly_ghosted" ? (
                    <span
                      className="badge badge-ghosted ml-1"
                      title="Possibly ghosted — inference"
                    >
                      possibly ghosted
                    </span>
                  ) : null}
                </td>
                <td className="font-mono text-xs">{a.source ?? "—"}</td>
                <td className="font-mono text-xs">
                  {a.lastEventAt
                    ? new Date(a.lastEventAt).toLocaleDateString()
                    : "—"}
                </td>
                <td>
                  <Link
                    to="/applications/$id"
                    params={{ id: a.id }}
                    className="btn-ghost text-xs"
                  >
                    Timeline
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
