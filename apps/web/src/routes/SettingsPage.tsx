import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client.js";

export function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["ghost-settings"],
    queryFn: () => api.ghostSettings(),
  });
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications(),
  });

  const [stale, setStale] = useState<string>("");
  const [ghost, setGhost] = useState<string>("");

  const save = useMutation({
    mutationFn: () => {
      const staleAfterDays = Number.parseInt(stale || String(settings.data?.thresholds.staleAfterDays ?? 45), 10);
      const ghostAfterDays = Number.parseInt(ghost || String(settings.data?.thresholds.ghostAfterDays ?? 90), 10);
      return api.updateGhostSettings({
        staleAfterDays,
        ghostAfterDays,
        perStage: settings.data?.thresholds.perStage ?? {},
        perType: settings.data?.thresholds.perType ?? {},
        perCompany: settings.data?.thresholds.perCompany ?? {},
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ghost-settings"] });
    },
  });

  const evaluate = useMutation({
    mutationFn: () => api.evaluateGhosts(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["applications"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const t = settings.data?.thresholds;

  return (
    <div data-testid="settings-page" className="space-y-6">
      <div>
        <h2 className="mb-1 font-display text-xl font-semibold">Settings</h2>
        <p className="text-sm text-ink-600">
          Gmail connection, classifier mode, and ghost thresholds. Analytics
          site keys are deferred (M14).
        </p>
      </div>

      <section className="panel space-y-3 p-4" data-testid="ghost-thresholds">
        <h3 className="font-medium">Ghost thresholds</h3>
        <p className="text-sm text-ink-700">
          Inference only — the UI says &quot;possibly ghosted&quot;. Timer pauses
          while a future interview or OA deadline exists; resets on meaningful
          activity. Defaults: stale {t?.staleAfterDays ?? 45}d / ghost{" "}
          {t?.ghostAfterDays ?? 90}d
          {settings.data?.algorithmVersion
            ? ` (${settings.data.algorithmVersion})`
            : ""}
          .
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Stale after (days)
            <input
              className="input mt-1 max-w-[8rem]"
              type="number"
              min={1}
              data-testid="stale-days"
              placeholder={String(t?.staleAfterDays ?? 45)}
              value={stale}
              onChange={(e) => setStale(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Possibly ghosted after (days)
            <input
              className="input mt-1 max-w-[8rem]"
              type="number"
              min={1}
              data-testid="ghost-days"
              placeholder={String(t?.ghostAfterDays ?? 90)}
              value={ghost}
              onChange={(e) => setGhost(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            data-testid="save-ghost-thresholds"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            Save thresholds
          </button>
          <button
            type="button"
            className="btn-ghost"
            data-testid="run-ghost-evaluate"
            disabled={evaluate.isPending}
            onClick={() => evaluate.mutate()}
          >
            Run ghost evaluate now
          </button>
        </div>
        {save.isSuccess ? (
          <p className="text-xs text-moss-600">Thresholds saved.</p>
        ) : null}
        {evaluate.isSuccess ? (
          <p className="text-xs text-ink-600">
            Scanned {evaluate.data.scanned}; transitions{" "}
            {evaluate.data.transitions.length}.
          </p>
        ) : null}
      </section>

      <section className="panel space-y-2 p-4">
        <h3 className="font-medium">Notifications</h3>
        {(notifications.data?.notifications ?? []).length === 0 ? (
          <p className="text-sm text-ink-600">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-ink-900/10">
            {(notifications.data?.notifications ?? []).map((n) => (
              <li key={n.id} className="py-2 text-sm">
                <p className="font-medium">{n.title}</p>
                {n.body ? <p className="text-ink-700">{n.body}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel space-y-2 p-4">
        <h3 className="font-medium">Gmail</h3>
        <p className="text-sm text-ink-700">
          Connect via{" "}
          <code className="font-mono text-xs">GET /api/v1/gmail/connect</code>{" "}
          when OAuth env is configured. Mock provider:{" "}
          <code className="font-mono text-xs">EMAIL_PROVIDER=mock</code>.
        </p>
      </section>
      <section className="panel space-y-2 p-4">
        <h3 className="font-medium">Classifier</h3>
        <p className="text-sm text-ink-700">
          Mode defaults to <code className="font-mono text-xs">deterministic</code>
          . LLM modes are M13 and opt-in.
        </p>
      </section>
      <section className="panel space-y-2 p-4 opacity-60">
        <h3 className="font-medium">Analytics sites</h3>
        <p className="text-sm text-ink-700">
          Coming in M14 — not part of this settings surface yet.
        </p>
      </section>
    </div>
  );
}
