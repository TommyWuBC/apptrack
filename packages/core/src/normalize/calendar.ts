/**
 * Calendar invite parse (.ics / text/calendar). AGENTS.md §12
 * Uses ical.js — no network.
 */
import ICAL from "ical.js";

export type CalendarEventNormalized = {
  summary?: string;
  start?: string;
  end?: string;
  tz?: string;
  location?: string;
  method?: string;
};

export function parseCalendarIcs(icsText: string): CalendarEventNormalized | null {
  try {
    const jcal = ICAL.parse(icsText);
    const comp = new ICAL.Component(jcal);
    const method = comp.getFirstPropertyValue("method") as string | null;
    const vevent = comp.getFirstSubcomponent("vevent");
    if (!vevent) return { method: method ?? undefined };

    const event = new ICAL.Event(vevent);
    const start = event.startDate;
    const end = event.endDate;
    return {
      summary: event.summary || undefined,
      start: start ? start.toString() : undefined,
      end: end ? end.toString() : undefined,
      tz: start?.zone?.tzid ?? undefined,
      location: event.location || undefined,
      method: method ?? undefined,
    };
  } catch {
    return null;
  }
}
