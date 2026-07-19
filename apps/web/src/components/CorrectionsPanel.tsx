import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApplicationState } from "@apptrack/shared";
import { api } from "../api/client.js";

const STATES = Object.values(ApplicationState);

export function CorrectionsPanel({
  applicationId,
  initialState,
  initialActionRequired,
  expectedVersion,
}: {
  applicationId: string;
  initialState?: string;
  initialActionRequired?: boolean;
  expectedVersion?: string;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["corrections", applicationId],
    queryFn: () => api.corrections(applicationId),
  });
  const [state, setState] = useState(initialState ?? "unknown");
  const [actionRequired, setActionRequired] = useState(
    initialActionRequired ?? false,
  );
  const [lock, setLock] = useState(true);

  useEffect(() => {
    if (initialState) setState(initialState);
  }, [initialState]);
  useEffect(() => {
    if (initialActionRequired !== undefined) {
      setActionRequired(initialActionRequired);
    }
  }, [initialActionRequired]);

  const patch = useMutation({
    mutationFn: () =>
      api.patchApplication(applicationId, {
        fields: [
          { field: "currentState", userValue: state, locked: lock },
          {
            field: "actionRequired",
            userValue: actionRequired,
            locked: lock,
          },
        ],
        expectedVersion,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["corrections", applicationId] });
      void qc.invalidateQueries({ queryKey: ["timeline", applicationId] });
      void qc.invalidateQueries({ queryKey: ["application", applicationId] });
      void qc.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const undo = useMutation({
    mutationFn: (id: string) => api.undoCorrection(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["corrections", applicationId] });
      void qc.invalidateQueries({ queryKey: ["timeline", applicationId] });
      void qc.invalidateQueries({ queryKey: ["application", applicationId] });
    },
  });

  const active = (data?.corrections ?? []).filter((c) => !c.revertedAt);

  return (
    <section className="panel space-y-4 p-4" data-testid="corrections-panel">
      <div>
        <h3 className="font-medium">Corrections</h3>
        <p className="text-xs text-ink-600">
          Locked fields survive reprocess (INV-7). Undo restores the prior
          correction.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-ink-600">Stage</span>
          <select
            className="input max-w-[14rem]"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={actionRequired}
            onChange={(e) => setActionRequired(e.target.checked)}
          />
          Action required
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lock}
            onChange={(e) => setLock(e.target.checked)}
          />
          Lock
        </label>
        <button
          type="button"
          className="btn text-xs"
          disabled={patch.isPending}
          onClick={() => patch.mutate()}
        >
          Save correction
        </button>
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-ink-600">No active corrections.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-900/10 pb-2 text-sm"
            >
              <div>
                <span className="font-mono">{c.field}</span> →{" "}
                <span className="font-medium">{String(c.userValue)}</span>
                {c.locked ? <span className="badge ml-2">locked</span> : null}
              </div>
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={undo.isPending}
                onClick={() => undo.mutate(c.id)}
              >
                Undo
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
