import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function CompaniesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api.companies(),
  });
  const [survivor, setSurvivor] = useState("");
  const [source, setSource] = useState("");

  const merge = useMutation({
    mutationFn: () => api.mergeCompanies(survivor, source),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["companies"] });
      void qc.invalidateQueries({ queryKey: ["review"] });
      setSource("");
    },
  });

  if (isLoading) return <p className="text-sm text-ink-600">Loading…</p>;
  if (error) {
    return <p className="text-sm text-red-700">{(error as Error).message}</p>;
  }

  const companies = data?.companies ?? [];

  return (
    <div data-testid="companies-page" className="space-y-6">
      <div>
        <h2 className="mb-1 font-display text-xl font-semibold">Companies</h2>
        <p className="text-sm text-ink-600">
          Resolved employers. Manual merge only — never silent (AGENTS.md §14.4).
        </p>
      </div>

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
            {companies.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.canonicalName}</td>
                <td className="font-mono text-xs">{c.primaryDomain ?? "—"}</td>
                <td>{c.isStaffingAgency ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="panel space-y-3 p-4" data-testid="company-merge">
        <h3 className="font-medium">Merge companies</h3>
        <div className="flex flex-wrap gap-2">
          <select
            className="input max-w-xs"
            value={survivor}
            onChange={(e) => setSurvivor(e.target.value)}
            aria-label="Survivor company"
          >
            <option value="">Survivor…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.canonicalName}
              </option>
            ))}
          </select>
          <select
            className="input max-w-xs"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Source company"
          >
            <option value="">Merge from…</option>
            {companies
              .filter((c) => c.id !== survivor)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.canonicalName}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="btn text-xs"
            disabled={!survivor || !source || merge.isPending}
            onClick={() => merge.mutate()}
          >
            Merge
          </button>
        </div>
        {merge.isError ? (
          <p className="text-sm text-red-700">{(merge.error as Error).message}</p>
        ) : null}
      </section>
    </div>
  );
}
