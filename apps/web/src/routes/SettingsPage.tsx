export function SettingsPage() {
  return (
    <div data-testid="settings-page" className="space-y-6">
      <div>
        <h2 className="mb-1 font-display text-xl font-semibold">Settings</h2>
        <p className="text-sm text-ink-600">
          Gmail connection, classifier mode, and ghost thresholds. Analytics
          site keys are deferred (M14).
        </p>
      </div>
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
