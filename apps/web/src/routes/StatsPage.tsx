import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { RateStatDisplay } from "../components/RateStatDisplay.js";

export function StatsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.stats(),
  });

  if (isLoading) return <p className="text-sm text-ink-600">Loading stats…</p>;
  if (error) {
    return <p className="text-sm text-red-700">{(error as Error).message}</p>;
  }
  const s = data!;

  return (
    <div data-testid="stats-page">
      <h2 className="mb-1 font-display text-xl font-semibold">Stats</h2>
      <p className="mb-6 text-sm text-ink-600">
        Rates on n &lt; {s.smallSampleThreshold} show as n/N — never a bold percentage
        (small-sample guard).
      </p>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-xs uppercase text-ink-600">Applications</p>
          <p className="font-display text-3xl font-semibold">{s.totals.applications}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase text-ink-600">Action required</p>
          <p className="font-display text-3xl font-semibold">{s.totals.actionRequired}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs uppercase text-ink-600">This week</p>
          <p className="font-display text-3xl font-semibold">{s.applicationsThisWeek}</p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.values(s.rates).map((r) => (
          <div key={r.label} className="panel p-4">
            <RateStatDisplay stat={r} />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-4">
          <h3 className="mb-3 font-medium">By state</h3>
          <ul className="space-y-1 text-sm">
            {Object.entries(s.byState).map(([state, n]) => (
              <li key={state} className="flex justify-between font-mono">
                <span>{state}</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-4">
          <h3 className="mb-3 font-medium">Most active companies</h3>
          <ul className="space-y-1 text-sm">
            {s.topCompaniesByActivity.map((c) => (
              <li key={c.companyId} className="flex justify-between">
                <span>{c.name}</span>
                <span className="font-mono">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
