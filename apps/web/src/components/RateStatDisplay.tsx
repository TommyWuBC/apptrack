import type { RateStat } from "../api/client.js";

/** Small-sample guard: n < 10 → n/N, never a bold percentage. AGENTS.md §19 */
export function formatRate(stat: RateStat): string {
  if (stat.denominator === 0) return "n/a";
  if (stat.smallSample || stat.rate === null) {
    return `${stat.numerator}/${stat.denominator}`;
  }
  return `${(stat.rate * 100).toFixed(0)}%`;
}

export function RateStatDisplay({
  stat,
  className = "",
}: {
  stat: RateStat;
  className?: string;
}) {
  const text = formatRate(stat);
  const isPct = text.endsWith("%");
  return (
    <div className={className} data-testid="rate-stat">
      <p className="text-xs uppercase tracking-wide text-ink-600">{stat.label}</p>
      <p
        className={
          isPct
            ? "font-display text-2xl font-semibold text-ink-950"
            : "font-mono text-2xl text-ink-800"
        }
        data-small-sample={stat.smallSample ? "true" : "false"}
        title={stat.smallSample ? "Sample too small for a percentage" : undefined}
      >
        {text}
      </p>
      {stat.smallSample ? (
        <p className="mt-1 text-xs text-ink-600">sample too small for a percentage</p>
      ) : null}
    </div>
  );
}
