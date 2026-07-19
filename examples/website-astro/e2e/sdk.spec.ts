import { expect, test } from "@playwright/test";

type Batch = {
  siteKey: string;
  events: Array<{
    eventType: string;
    path?: string;
    srcToken?: string;
  }>;
};

async function captured(page: import("@playwright/test").Page): Promise<Batch[]> {
  const res = await page.request.get("/__e2e/captured");
  return (await res.json()) as Batch[];
}

async function reset(page: import("@playwright/test").Page): Promise<void> {
  await page.request.get("/__e2e/reset");
}

test.describe("M15 analytics SDK", () => {
  test.beforeEach(async ({ page }) => {
    await reset(page);
  });

  test("auto page_view on load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-page")).toBeVisible();
    await page.waitForFunction(() => Boolean(window.apptrack));
    await page.evaluate(() => window.apptrack?.flush());
    await expect.poll(async () => (await captured(page)).length).toBeGreaterThan(0);
    const batches = await captured(page);
    const types = batches.flatMap((b) => b.events.map((e) => e.eventType));
    expect(types).toContain("page_view");
    expect(batches[0]!.siteKey).toMatch(/^pk_/);
  });

  test("SPA pushState emits another page_view", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.apptrack));
    await page.evaluate(() => window.apptrack?.flush());
    await reset(page);

    await page.getByTestId("spa-nav").click();
    await expect(page.getByTestId("spa-projects-view")).toBeVisible();
    await page.evaluate(() => window.apptrack?.flush());

    await expect.poll(async () => (await captured(page)).length).toBeGreaterThan(0);
    const events = (await captured(page)).flatMap((b) => b.events);
    expect(events.some((e) => e.eventType === "page_view" && e.path?.includes("/projects"))).toBe(
      true,
    );
  });

  test("?src= token is attached to events", async ({ page }) => {
    await page.goto("/?src=tok_e2e_abc");
    await page.waitForFunction(() => Boolean(window.apptrack));
    await page.evaluate(() => window.apptrack?.flush());
    await expect.poll(async () => (await captured(page)).length).toBeGreaterThan(0);
    const events = (await captured(page)).flatMap((b) => b.events);
    expect(events.every((e) => e.srcToken === "tok_e2e_abc")).toBe(true);
  });

  test("sendBeacon failure falls back to fetch", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "sendBeacon", {
        configurable: true,
        value: () => false,
      });
    });
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.apptrack));
    await page.getByTestId("github-click").click();
    await expect.poll(async () => (await captured(page)).length).toBeGreaterThan(0);
    const events = (await captured(page)).flatMap((b) => b.events);
    expect(events.some((e) => e.eventType === "github_click")).toBe(true);
  });
});
