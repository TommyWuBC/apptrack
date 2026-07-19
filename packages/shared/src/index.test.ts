import { describe, expect, it } from "vitest";
import { EventType, ExtractionV1Schema } from "../src/index.js";

describe("@apptrack/shared", () => {
  it("exposes FR-1 event types", () => {
    expect(EventType.application_confirmation).toBe("application_confirmation");
    expect(EventType.rejection).toBe("rejection");
  });

  it("validates an empty ExtractionV1", () => {
    const result = ExtractionV1Schema.safeParse({});
    expect(result.success).toBe(true);
  });
});
