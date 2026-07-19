import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function CorrelationPanel({ applicationId }: { applicationId: string }) {
  const qc = useQueryClient();
  const version = useQuery({
    queryKey: ["correlation-version"],
    queryFn: () => api.correlationVersion(),
  });
  const correlations = useQuery({
    queryKey: ["correlations", applicationId],
    queryFn: () => api.correlations(applicationId),
  });
  const mint = useMutation({
    mutationFn: () => api.mintLink(applicationId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["application", applicationId] });
      void qc.invalidateQueries({ queryKey: ["correlations", applicationId] });
    },
  });
  const revoke = useMutation({
    mutationFn: () => api.revokeLink(applicationId),
    onSuccess: () => {
      mint.reset();
      void qc.invalidateQueries({ queryKey: ["application", applicationId] });
    },
  });
  const feedback = useMutation({
    mutationFn: (input: { id: string; feedback: "confirmed" | "rejected" }) =>
      api.correlationFeedback(input.id, input.feedback),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["correlations", applicationId] });
    },
  });

  const enabled = version.data?.enabled ?? correlations.data?.enabled ?? false;
  const predictions = correlations.data?.predictions ?? [];

  return (
    <section className="panel space-y-3 p-4" data-testid="correlation-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">Possible related visits</h3>
        <p className="font-mono text-xs text-ink-600">
          {version.data?.algorithmVersion ?? "corr-v1"}
        </p>
      </div>
      <p className="text-sm text-ink-700">
        Anonymous portfolio visits can be estimated against this application. Scores are
        inference only — never identification. Probabilistic confidence stops at medium
        unless a unique link makes attribution deterministic.
      </p>
      {!enabled ? (
        <p className="text-sm text-ink-600" data-testid="correlation-disabled">
          Correlation is disabled. Set{" "}
          <code className="font-mono text-xs">CORRELATION_ENABLED=true</code> after
          analytics is configured.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn text-xs"
          data-testid="mint-unique-link"
          disabled={mint.isPending}
          onClick={() => mint.mutate()}
        >
          Mint unique link
        </button>
        <button
          type="button"
          className="btn-ghost text-xs"
          data-testid="revoke-unique-link"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate()}
        >
          Revoke link
        </button>
      </div>
      {mint.isSuccess ? (
        <div className="space-y-1 text-xs" data-testid="minted-link">
          <p>
            Portfolio:{" "}
            <code className="font-mono break-all">{mint.data.link.portfolioUrl}</code>
          </p>
          <p>
            Tracked résumé:{" "}
            <code className="font-mono break-all">{mint.data.link.resumeUrl}</code>
          </p>
        </div>
      ) : null}
      {enabled && predictions.length === 0 ? (
        <p className="text-sm text-ink-600">No scored visits yet for this application.</p>
      ) : null}
      <ul className="space-y-3">
        {predictions.map((prediction) => (
          <li
            key={prediction.id}
            className="border-b border-ink-900/10 pb-3 text-sm"
            data-testid="correlation-prediction"
          >
            <p className="font-medium">
              {prediction.confidenceBand} · score {prediction.score.toFixed(2)}
              {prediction.deterministic ? " · unique link" : ""}
            </p>
            <p className="text-ink-700">{prediction.explanation}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={feedback.isPending || prediction.userFeedback === "confirmed"}
                onClick={() =>
                  feedback.mutate({ id: prediction.id, feedback: "confirmed" })
                }
              >
                Looks related
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={feedback.isPending || prediction.userFeedback === "rejected"}
                onClick={() =>
                  feedback.mutate({ id: prediction.id, feedback: "rejected" })
                }
              >
                Not related
              </button>
              {prediction.userFeedback ? (
                <span className="text-xs text-ink-600">
                  Feedback: {prediction.userFeedback}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
