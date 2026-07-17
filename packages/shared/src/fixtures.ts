import { z } from "zod";
import { EventType } from "./enums.js";
import { ExtractionV1Schema } from "./schemas.js";

const eventTypeValues = Object.values(EventType) as [string, ...string[]];

/**
 * Sibling label for synthetic `.eml` fixtures.
 * AGENTS.md §24.2–24.4 — fixtures/emails/<ats>/<event_type>/<name>.expected.json
 */
export const FixtureExpectedV1Schema = z.object({
  eventType: z.enum(eventTypeValues),
  extraction: ExtractionV1Schema,
  minConfidence: z.number().min(0).max(1),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type FixtureExpectedV1 = z.infer<typeof FixtureExpectedV1Schema>;

/** Golden-set baseline metrics. M3 ships zeros; M7+ fills real F1. */
export const GoldenBaselineV1Schema = z.object({
  version: z.literal("1"),
  generatedAt: z.string(),
  classifierVersion: z.string().nullable(),
  overall: z.object({
    precision: z.number(),
    recall: z.number(),
    f1: z.number(),
    support: z.number(),
  }),
  perEventType: z.record(
    z.object({
      precision: z.number(),
      recall: z.number(),
      f1: z.number(),
      support: z.number(),
    }),
  ),
  notes: z.string().optional(),
});

export type GoldenBaselineV1 = z.infer<typeof GoldenBaselineV1Schema>;
