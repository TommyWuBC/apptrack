import { useEffect, useState } from "react";
import { api, type EvidenceResponse } from "../api/client.js";

/**
 * Sandboxed email evidence viewer. AGENTS.md §19 / T4
 * Uses iframe sandbox — no scripts; HTML is already sanitized server-side.
 */
export function EvidenceViewer({
  messageId,
  onClose,
}: {
  messageId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<EvidenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api
      .evidence(messageId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-title"
      data-testid="evidence-viewer"
    >
      <div className="panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-4 shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 id="evidence-title" className="text-lg font-semibold">
              Email evidence
            </h2>
            <p className="font-mono text-xs text-ink-600">{messageId}</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {!data && !error ? (
          <p className="text-sm text-ink-600">Loading…</p>
        ) : null}
        {data ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{data.subject ?? "(no subject)"}</p>
              <p className="text-xs text-ink-600">
                {data.fromName ?? ""} &lt;{data.fromAddress ?? "?"}&gt;
              </p>
            </div>
            {data.classification ? (
              <div className="panel p-3">
                <p className="text-xs uppercase text-ink-600">Classification</p>
                <p className="font-mono">
                  {data.classification.eventType} ·{" "}
                  {(data.classification.confidence * 100).toFixed(0)}%
                </p>
                <ul className="mt-2 list-inside list-disc text-sm text-ink-700">
                  {data.classification.evidence.map((e, i) => (
                    <li key={i}>{e.detail}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {data.sanitizedHtml ? (
              <iframe
                title="Sanitized email body"
                sandbox=""
                className="h-64 w-full rounded border border-ink-900/15 bg-white"
                srcDoc={data.sanitizedHtml}
                data-testid="evidence-iframe"
              />
            ) : (
              <pre className="whitespace-pre-wrap rounded bg-parchment-100 p-3 text-sm">
                {data.textPlain ?? "(no body)"}
              </pre>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
