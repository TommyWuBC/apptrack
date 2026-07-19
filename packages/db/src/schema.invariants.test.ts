import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  analyticsSessions,
  analyticsEvents,
  analyticsSites,
  oauthCredentials,
  applicationEvents,
} from "./schema/index.js";
import { uuidv7 } from "./ids.js";

function assertNoIpColumns(cols: string[]) {
  const lower = cols.map((c) => c.toLowerCase());
  expect(lower).not.toContain("ip");
  expect(cols).not.toContain("ipAddress");
  expect(cols).not.toContain("ip_address");
  expect(lower).not.toContain("rawip");
}

describe("schema invariants", () => {
  it("INV-8: analytics tables have no IP columns", () => {
    assertNoIpColumns(Object.keys(getTableColumns(analyticsSessions)));
    assertNoIpColumns(Object.keys(getTableColumns(analyticsEvents)));
    assertNoIpColumns(Object.keys(getTableColumns(analyticsSites)));
    expect(getTableName(analyticsSessions)).toBe("analytics_sessions");
    expect(getTableName(analyticsEvents)).toBe("analytics_events");
  });

  it("INV-1: oauth_credentials has only encrypted token columns", () => {
    const cols = Object.keys(getTableColumns(oauthCredentials));
    expect(cols).toContain("encryptedRefreshToken");
    expect(cols).toContain("encryptedAccessToken");
    expect(cols).toContain("keyId");
    const forbidden = cols.filter(
      (c) =>
        /^(refreshToken|accessToken|token|password)$/i.test(c) ||
        c === "refresh_token" ||
        c === "access_token",
    );
    expect(forbidden).toEqual([]);
  });

  it("INV-9: application_events table exists (append-only contract)", () => {
    expect(getTableName(applicationEvents)).toBe("application_events");
    const cols = Object.keys(getTableColumns(applicationEvents));
    expect(cols).toContain("occurredAt");
    expect(cols).toContain("ingestedAt");
    expect(cols).toContain("supersededBy");
  });

  it("uuidv7 produces version-7 ids", () => {
    const a = uuidv7();
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("analytics_events carry sessionization context columns", () => {
    const cols = Object.keys(getTableColumns(analyticsEvents));
    expect(cols).toContain("siteId");
    expect(cols).toContain("visitorHash");
    expect(cols).toContain("sessionizedAt");
  });
});
