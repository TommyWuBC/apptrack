import { EventType } from "@apptrack/shared";

type TemplateDefinition = {
  platform: string;
  senderMarkers: string[];
  structuralMarkers?: string[];
};

const PLATFORMS: TemplateDefinition[] = [
  { platform: "greenhouse", senderMarkers: ["greenhouse.io"] },
  { platform: "lever", senderMarkers: ["lever.co", "hire.lever.co"] },
  { platform: "workday", senderMarkers: ["myworkday.com", "workday.com"] },
  { platform: "ashby", senderMarkers: ["ashbyhq.com"] },
  { platform: "icims", senderMarkers: ["icims.com"] },
  { platform: "smartrecruiters", senderMarkers: ["smartrecruiters.com"] },
  { platform: "taleo", senderMarkers: ["taleo.net"] },
  { platform: "jobvite", senderMarkers: ["jobvite.com"] },
  { platform: "successfactors", senderMarkers: ["successfactors.com"] },
  { platform: "bamboohr", senderMarkers: ["bamboohr.com"] },
  { platform: "rippling", senderMarkers: ["rippling.com"] },
  { platform: "hackerrank", senderMarkers: ["hackerrank.com"] },
  { platform: "codesignal", senderMarkers: ["codesignal.com"] },
  { platform: "codility", senderMarkers: ["codility.com"] },
  { platform: "hirevue", senderMarkers: ["hirevue.com"] },
  { platform: "karat", senderMarkers: ["karat.com"] },
  { platform: "coderpad", senderMarkers: ["coderpad.io"] },
  { platform: "goodtime", senderMarkers: ["goodtime.io"] },
  { platform: "calendly", senderMarkers: ["calendly.com"] },
  { platform: "modernloop", senderMarkers: ["modernloop.io"] },
];

const EVENT_MARKERS: Array<{
  eventType: EventType;
  markers: string[];
  antiMarkers?: string[];
}> = [
  {
    eventType: EventType.rejection,
    markers: ["not moving forward", "pursue other candidates", "unfortunately"],
    antiMarkers: ["interview is confirmed"],
  },
  {
    eventType: EventType.offer,
    markers: ["pleased to offer", "offer letter", "employment offer"],
  },
  {
    eventType: EventType.interview_cancelled,
    markers: ["interview has been cancelled", "interview canceled"],
  },
  {
    eventType: EventType.interview_rescheduled,
    markers: ["interview has been rescheduled", "updated interview time"],
  },
  {
    eventType: EventType.interview_scheduled,
    markers: ["interview is confirmed", "interview schedule", "scheduled interview"],
  },
  {
    eventType: EventType.interview_invitation,
    markers: ["invite you to interview", "schedule an interview", "interview invitation"],
  },
  {
    eventType: EventType.oa_reminder,
    markers: ["assessment reminder", "assessment is due", "complete your assessment"],
  },
  {
    eventType: EventType.oa_invitation,
    markers: ["coding assessment", "technical assessment", "online assessment"],
  },
  {
    eventType: EventType.application_confirmation,
    markers: [
      "application has been received",
      "thank you for applying",
      "application confirmation",
    ],
  },
];

export type AtsTemplateMatch = {
  platform: string;
  eventType: EventType;
  confidence: number;
  detail: string;
};

/** High-precision L1 platform + structural-template detector. §13.1 */
export function detectAtsTemplate(input: {
  fromAddress?: string;
  subject?: string;
  text?: string;
}): AtsTemplateMatch | null {
  const sender = (input.fromAddress ?? "").toLowerCase();
  const haystack = `${input.subject ?? ""}\n${input.text ?? ""}`.toLowerCase();
  const platform = PLATFORMS.find(
    (candidate) =>
      candidate.senderMarkers.some((marker) => sender.includes(marker)) ||
      candidate.structuralMarkers?.some((marker) =>
        haystack.includes(marker.toLowerCase()),
      ),
  );
  if (!platform) return null;

  for (const event of EVENT_MARKERS) {
    if (
      event.antiMarkers?.some((marker) => haystack.includes(marker))
    ) {
      continue;
    }
    const marker = event.markers.find((candidate) =>
      haystack.includes(candidate),
    );
    if (marker) {
      return {
        platform: platform.platform,
        eventType: event.eventType,
        confidence: 0.94,
        detail: `Matched ${platform.platform} ${event.eventType} template marker: "${marker}"`,
      };
    }
  }
  return null;
}
