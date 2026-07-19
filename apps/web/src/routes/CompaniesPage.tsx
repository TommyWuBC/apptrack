import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function CompaniesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api.companies(),
  });

  if (isLoading) return <p className="text-sm text-ink-600">Loading…</p>;
  if (error) {
    return <p className="text-sm text-red-700">{(error as Error).message}</p>;
  }

  return (
    <div data-testid="companies-page">
      <h2 className="mb-1 font-display text-xl font-semibold">Companies</h2>
      <p className="mb-4 text-sm text-ink-600">
        Resolved employers. Merge/split tools arrive in M11.
      </p>
      <div className="table-wrap panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Staffing?</th>
            </tr>
          </thead>
          <tbody>
            {(data?.companies ?? []).map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.canonicalName}</td>
                <td className="font-mono text-xs">{c.primaryDomain ?? "—"}</td>
                <td>{c.isStaffingAgency ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
