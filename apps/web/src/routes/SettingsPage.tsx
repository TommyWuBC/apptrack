import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["ghost-settings"],
    queryFn: () => api.ghostSettings(),
  });
  const classifier = useQuery({
    queryKey: ["classifier-settings"],
    queryFn: () => api.classifierSettings(),
  });
  const analyticsSites = useQuery({
    queryKey: ["analytics-sites"],
    queryFn: () => api.analyticsSites(),
  });
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications(),
  });

  const [stale, setStale] = useState<string>("");
  const [ghost, setGhost] = useState<string>("");
  const [mode, setMode] = useState("deterministic");
  const [provider, setProvider] = useState<string>("");
  const [siteOrigins, setSiteOrigins] = useState("http://localhost:4321");
  const [siteMode, setSiteMode] = useState<"full" | "no_geo" | "off">("full");

  useEffect(() => {
    if (classifier.data?.settings.mode) {
      setMode(classifier.data.settings.mode);
    }
    if (classifier.data?.settings.provider) {
      setProvider(classifier.data.settings.provider);
    }
  }, [classifier.data]);

  const save = useMutation({
    mutationFn: () => {
      const staleAfterDays = Number.parseInt(
        stale || String(settings.data?.thresholds.staleAfterDays ?? 45),
        10,
      );
      const ghostAfterDays = Number.parseInt(
        ghost || String(settings.data?.thresholds.ghostAfterDays ?? 90),
        10,
      );
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

  const saveClassifier = useMutation({
    mutationFn: () =>
      api.updateClassifierSettings({
        mode: mode as "deterministic" | "local" | "api" | "hybrid",
        provider:
          provider === "anthropic" || provider === "openai" || provider === "ollama"
            ? provider
            : null,
        modelId: null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["classifier-settings"] });
    },
  });

  const evaluate = useMutation({
    mutationFn: () => api.evaluateGhosts(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["applications"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const reprocess = useMutation({
    mutationFn: () => api.reprocess({ scope: "all" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["applications"] });
      void qc.invalidateQueries({ queryKey: ["review"] });
    },
  });

  const createSite = useMutation({
    mutationFn: () =>
      api.createAnalyticsSite({
        originAllowlist: siteOrigins
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        mode: siteMode,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["analytics-sites"] });
    },
  });

  const t = settings.data?.thresholds;
  const egress =
    saveClassifier.data?.egressDisclosure ?? classifier.data?.egressDisclosure ?? "";

  return (
    <div data-testid="settings-page" className="space-y-6">
      <div>
        <h2 className="mb-1 font-display text-xl font-semibold">Settings</h2>
        <p className="text-sm text-ink-600">
          Gmail connection, classifier mode, ghost thresholds, and analytics sites.
          Portfolio SDK embed is M15.
        </p>
      </div>

      <section className="panel space-y-3 p-4" data-testid="classifier-settings">
        <h3 className="font-medium">Classifier</h3>
        <p className="text-sm text-ink-700">
          Default is <code className="font-mono text-xs">deterministic</code> — fully
          local, no model keys required. LLM modes are opt-in.
          {classifier.data?.classifierVersion
            ? ` (${classifier.data.classifierVersion} / ${classifier.data.promptVersion})`
            : ""}
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Mode
            <select
              className="input mt-1 max-w-[12rem]"
              data-testid="classifier-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="deterministic">deterministic</option>
              <option value="hybrid">hybrid</option>
              <option value="api">api</option>
              <option value="local">local (Ollama)</option>
            </select>
          </label>
          <label className="text-sm">
            Provider
            <select
              className="input mt-1 max-w-[12rem]"
              data-testid="classifier-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={mode === "deterministic"}
            >
              <option value="">auto</option>
              <option value="anthropic">anthropic</option>
              <option value="openai">openai</option>
              <option value="ollama">ollama</option>
            </select>
          </label>
        </div>
        <div
          className="rounded border border-ink-900/10 bg-white/50 p-3 text-sm text-ink-800"
          data-testid="egress-disclosure"
        >
          <p className="mb-1 font-medium">What leaves this machine</p>
          <p>{egress || "Loading disclosure…"}</p>
          {classifier.data?.keysPresent ? (
            <p className="mt-2 font-mono text-xs text-ink-600">
              keys: anthropic=
              {classifier.data.keysPresent.anthropic ? "yes" : "no"}, openai=
              {classifier.data.keysPresent.openai ? "yes" : "no"}, ollamaUrl=
              {classifier.data.keysPresent.ollamaUrl ? "yes" : "no"}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn"
          data-testid="save-classifier"
          disabled={saveClassifier.isPending}
          onClick={() => saveClassifier.mutate()}
        >
          Save classifier settings
        </button>
        {saveClassifier.isSuccess ? (
          <p className="text-xs text-moss-600">Classifier settings saved.</p>
        ) : null}
      </section>

      <section className="panel space-y-3 p-4" data-testid="reprocess-settings">
        <h3 className="font-medium">Reprocess stored email</h3>
        <p className="text-sm text-ink-700">
          Re-run normalization, classification, matching, and projections from local data.
          Gmail is not contacted; versioned results make retries idempotent.
        </p>
        <button
          type="button"
          className="btn-ghost"
          disabled={reprocess.isPending}
          onClick={() => {
            if (
              window.confirm("Reprocess all stored email with the current classifier?")
            ) {
              reprocess.mutate();
            }
          }}
        >
          {reprocess.isPending ? "Queueing…" : "Reprocess all email"}
        </button>
        {reprocess.isSuccess ? (
          <p className="text-xs text-moss-600">Reprocess queued.</p>
        ) : null}
      </section>

      <section className="panel space-y-3 p-4" data-testid="ghost-thresholds">
        <h3 className="font-medium">Ghost thresholds</h3>
        <p className="text-sm text-ink-700">
          Inference only — the UI says &quot;possibly ghosted&quot;. Timer pauses while a
          future interview or OA deadline exists; resets on meaningful activity. Defaults:
          stale {t?.staleAfterDays ?? 45}d / ghost {t?.ghostAfterDays ?? 90}d
          {settings.data?.algorithmVersion ? ` (${settings.data.algorithmVersion})` : ""}.
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
          Connect via <code className="font-mono text-xs">GET /api/v1/gmail/connect</code>{" "}
          when OAuth env is configured. Mock provider:{" "}
          <code className="font-mono text-xs">EMAIL_PROVIDER=mock</code>.
        </p>
      </section>

      <section className="panel space-y-3 p-4" data-testid="analytics-sites">
        <h3 className="font-medium">Analytics sites</h3>
        <p className="text-sm text-ink-700">
          Cookie-free ingest at{" "}
          <code className="font-mono text-xs">POST /api/v1/analytics/events</code>. Modes:
          full (optional geo), no_geo, off. Raw IPs are never stored.
        </p>
        <ul className="space-y-2 text-sm">
          {(analyticsSites.data?.sites ?? []).map((s) => (
            <li key={s.id} className="border-b border-ink-900/10 pb-2">
              <p className="font-mono text-xs">{s.siteKey}</p>
              <p className="text-ink-600">
                mode={s.mode} · origins=
                {(s.originAllowlist ?? []).join(", ") || "(any)"}
              </p>
            </li>
          ))}
          {(analyticsSites.data?.sites ?? []).length === 0 ? (
            <li className="text-ink-600">No sites yet — create one below.</li>
          ) : null}
        </ul>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm grow">
            Origin allowlist (comma-separated)
            <input
              className="input mt-1"
              data-testid="analytics-origins"
              value={siteOrigins}
              onChange={(e) => setSiteOrigins(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Mode
            <select
              className="input mt-1 max-w-[8rem]"
              data-testid="analytics-mode"
              value={siteMode}
              onChange={(e) => setSiteMode(e.target.value as "full" | "no_geo" | "off")}
            >
              <option value="full">full</option>
              <option value="no_geo">no_geo</option>
              <option value="off">off</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className="btn"
          data-testid="create-analytics-site"
          disabled={createSite.isPending}
          onClick={() => createSite.mutate()}
        >
          Create site key
        </button>
        {createSite.isSuccess ? (
          <p className="text-xs text-moss-600">
            Created{" "}
            <code className="font-mono">
              {(createSite.data as { site: { siteKey: string } }).site.siteKey}
            </code>
          </p>
        ) : null}
      </section>
    </div>
  );
}
