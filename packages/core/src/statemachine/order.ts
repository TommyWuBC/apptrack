/**
 * Canonical event ordering for replay. AGENTS.md §16.4
 * Sort by (occurred_at, ingested_at, id).
 */
import type { ReducerEventV1 } from "@apptrack/shared";

export function compareReducerEvents(
  a: ReducerEventV1,
  b: ReducerEventV1,
): number {
  const oc = a.occurredAt.getTime() - b.occurredAt.getTime();
  if (oc !== 0) return oc;
  const ic = a.ingestedAt.getTime() - b.ingestedAt.getTime();
  if (ic !== 0) return ic;
  return a.id.localeCompare(b.id);
}

export function orderEvents(events: ReducerEventV1[]): ReducerEventV1[] {
  return [...events]
    .filter((e) => !e.supersededBy)
    .sort(compareReducerEvents);
}

/** Calendar day key in UTC for same-day conflict detection. */
export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
