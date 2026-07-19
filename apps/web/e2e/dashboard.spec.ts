import { expect, test } from "@playwright/test";

test.describe("M10 dashboard demo smoke", () => {
  test("overview → applications → timeline → stats", async ({ page }) => {
    await page.goto("/?demo=1");
    await expect(page.getByTestId("demo-banner")).toBeVisible();
    await expect(page.getByTestId("overview-page")).toBeVisible();
    await expect(page.getByText("Initech").first()).toBeVisible();

    await page.getByRole("link", { name: "Applications" }).click();
    await expect(page.getByTestId("applications-page")).toBeVisible();

    await page.getByRole("link", { name: "Timeline" }).first().click();
    await expect(page.getByTestId("application-detail")).toBeVisible();
    await expect(page.getByTestId("timeline")).toBeVisible();

    await page.getByRole("link", { name: "Stats" }).click();
    await expect(page.getByTestId("stats-page")).toBeVisible();
    // Small-sample: demo totals n=4 → n/N not bold %
    await expect(page.getByTestId("rate-stat").first()).toBeVisible();
    await expect(
      page.getByText("sample too small for a percentage").first(),
    ).toBeVisible();

    await page.getByRole("link", { name: "Companies" }).click();
    await expect(page.getByTestId("companies-page")).toBeVisible();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByTestId("settings-page")).toBeVisible();
  });
});
