import { describe, expect, it } from "vitest";
import {
  EmailBackfillJobV1Schema,
  EmailReprocessJobV1Schema,
  EmailSyncJobV1Schema,
  JobName,
  MessageJobV1Schema,
} from "./jobs.js";

describe("job contracts", () => {
  it("keeps stable dot-delimited job names", () => {
    expect(Object.values(JobName)).toContain("email.sync");
    expect(Object.values(JobName)).toContain("application.recompute");
    expect(Object.values(JobName)).toContain("retention.cleanup");
  });

  it("validates natural-key payloads", () => {
    expect(EmailSyncJobV1Schema.parse({})).toEqual({});
    expect(
      MessageJobV1Schema.safeParse({
        messageId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      EmailBackfillJobV1Schema.parse({
        afterDate: "2026-01-01",
      }).maxMessages,
    ).toBe(500);
  });

  it("requires scope-specific reprocess fields", () => {
    expect(
      EmailReprocessJobV1Schema.safeParse({
        scope: "message_ids",
        messageIds: [],
      }).success,
    ).toBe(false);
    expect(
      EmailReprocessJobV1Schema.safeParse({
        scope: "date_range",
        afterDate: "2026-01-01",
      }).success,
    ).toBe(true);
  });
});
