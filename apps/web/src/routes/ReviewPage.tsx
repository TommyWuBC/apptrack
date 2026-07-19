import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api, type ReviewItem } from "../api/client.js";

export function ReviewPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["review"],
    queryFn: () => api.review(),
  });

  const resolve = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => api.resolveReview(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["review"] });
      void qc.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  if (isLoading) return <p className="text-sm text-ink-600">Loading queue…</p>;
  if (error) {
    return <p className="text-sm text-red-700">{(error as Error).message}</p>;
  }

  const items = data?.items ?? [];

  return (
    <div data-testid="review-page" className="space-y-6">
      <div>
        <h2 className="mb-1 font-display text-xl font-semibold">Review</h2>
        <p className="text-sm text-ink-600">
          Ambiguous matches, merge suggestions, and conflicts — never guess;
          you decide.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="panel p-4 text-sm text-ink-600">Queue is empty.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <ReviewCard
              key={item.id}
              item={item}
              busy={resolve.isPending}
              onResolve={(body) => resolve.mutate({ id: item.id, body })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewCard({
  item,
  busy,
  onResolve,
}: {
  item: ReviewItem;
  busy: boolean;
  onResolve: (body: Record<string, unknown>) => void;
}) {
  const res = item.resolution as Record<string, unknown> | null;

  return (
    <li className="panel p-4" data-testid="review-item">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="badge">{item.kind}</span>
        <span className="font-mono text-xs text-ink-600">{item.refId}</span>
      </div>

      {item.kind === "ambiguous_match" ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-700">
            {(res?.match as { reason?: string } | undefined)?.reason ??
              "Ambiguous application match"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn text-xs"
              disabled={busy}
              onClick={() =>
                onResolve({
                  kind: "ambiguous_match",
                  action: "attach",
                  applicationId: "app-1",
                })
              }
            >
              Attach to app-1
            </button>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={busy}
              onClick={() =>
                onResolve({
                  kind: "ambiguous_match",
                  action: "new_application",
                })
              }
            >
              New application
            </button>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={busy}
              onClick={() =>
                onResolve({ kind: "ambiguous_match", action: "dismiss" })
              }
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-ink-600">
            Candidates:{" "}
            <Link to="/applications/$id" params={{ id: "app-1" }}>
              app-1
            </Link>
            {" · "}
            <Link to="/applications/$id" params={{ id: "app-4" }}>
              app-4
            </Link>
          </p>
        </div>
      ) : null}

      {item.kind === "entity_merge_suggestion" ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-700">
            Merge suggestion: {(res?.candidateName as string) ?? "?"} ≈{" "}
            {(res?.suggestedCanonicalName as string) ?? "?"} (
            {typeof res?.similarity === "number"
              ? `${(res.similarity * 100).toFixed(0)}%`
              : "?"}
            )
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn text-xs"
              disabled={busy}
              onClick={() =>
                onResolve({
                  kind: "entity_merge_suggestion",
                  action: "merge",
                  survivorCompanyId:
                    (res?.suggestedCompanyId as string) ?? "co-initech",
                  sourceCompanyId: item.refId,
                })
              }
            >
              Merge into suggested
            </button>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={busy}
              onClick={() =>
                onResolve({
                  kind: "entity_merge_suggestion",
                  action: "dismiss",
                })
              }
            >
              Keep separate
            </button>
          </div>
        </div>
      ) : null}

      {item.kind === "state_conflict" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn text-xs"
            disabled={busy}
            onClick={() =>
              onResolve({
                kind: "state_conflict",
                action: "accept_state",
                state: "interviewing",
                locked: true,
              })
            }
          >
            Lock as interviewing
          </button>
          <button
            type="button"
            className="btn-ghost text-xs"
            disabled={busy}
            onClick={() =>
              onResolve({ kind: "state_conflict", action: "dismiss" })
            }
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {!["ambiguous_match", "entity_merge_suggestion", "state_conflict"].includes(
        item.kind,
      ) ? (
        <button
          type="button"
          className="btn-ghost text-xs"
          disabled={busy}
          onClick={() =>
            onResolve({ kind: item.kind, action: "dismiss" })
          }
        >
          Dismiss
        </button>
      ) : null}
    </li>
  );
}
