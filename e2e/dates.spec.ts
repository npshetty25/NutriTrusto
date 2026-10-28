import { expect, jpeg, openDashboard, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** A purchase date `n` days back, in this machine's own calendar, as Postgres returns it. */
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const card = (page: Page, name: string) =>
  page.locator(".neu-pressable").filter({ has: page.getByRole("heading", { level: 3, name }) });

test.describe("dates on a card", () => {
  test("names a printed best-before date and counts the days past it", async ({ backend, page }) => {
    backend.seedPantry([
      { name: "Britannia Cheese Slices", days_left: 10, purchase_date: daysAgo(13), expiry_source: "printed", expiry_kind: "best_before" },
    ]);
    await openDashboard(page);

    const c = card(page, "Britannia Cheese Slices");
    await expect(c.getByText(/Best before .+, 3 days ago/)).toBeVisible();
    await expect(c.getByText("days past", { exact: true })).toBeVisible();
    await expect(c.getByText("Past date", { exact: true })).toBeVisible();
    await expect(c.getByText(/Past its best-before date/)).toBeVisible();
    // A quality date, not a safety one: never "Use by".
    await expect(c.getByText(/Use by/)).toHaveCount(0);
  });

  test("on the last day it says today, not past", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Spinach", days_left: 4, purchase_date: daysAgo(4) }]);
    await openDashboard(page);

    const c = card(page, "Spinach");
    await expect(c.getByText("Our estimate runs out today")).toBeVisible();
    await expect(c.getByText("Today", { exact: true })).toBeVisible();
    await expect(c.getByText("Eat today", { exact: true })).toBeVisible();
    await expect(c.getByText(/has run out|Past date/)).toHaveCount(0);
  });

  test("Opened it swaps a pack's date for the use-within limit", async ({ backend, page }) => {
    backend.seedPantry([
      { name: "Amul Taaza Milk", days_left: 85, purchase_date: daysAgo(0), expiry_source: "printed", expiry_kind: "best_before" },
    ]);
    await openDashboard(page);

    const c = card(page, "Amul Taaza Milk");
    await expect(c.getByText(/Best before/)).toBeVisible();
    await c.getByRole("button", { name: "Mark Amul Taaza Milk as opened" }).click();

    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Amul Taaza Milk opened");
    await expect.poll(() => backend.tables.pantry_items[0].days_left).toBe(7);
    expect(backend.tables.pantry_items[0].expiry_source).toBeNull();
    expect(backend.tables.pantry_items[0].opened_at).toBeTruthy();
    await expect(c.getByText(/Good till about/)).toBeVisible();
    await expect(c.getByText("Opened it")).toHaveCount(0);
  });

  test("the eat-soon chips say today or how many days past, not a bare '!'", async ({ backend, page }) => {
    backend.seedPantry([
      { name: "Spinach", days_left: 4, purchase_date: daysAgo(4) },
      { name: "Curd", days_left: 4, purchase_date: daysAgo(7) },
    ]);
    await openDashboard(page);

    const chips = page.getByLabel("Eat soon");
    await expect(chips.getByRole("button", { name: /today\s*Spinach/ })).toBeVisible();
    await expect(chips.getByRole("button", { name: /3d past\s*Curd/ })).toBeVisible();
  });

  test("does not offer Opened it for fresh produce", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Tomatoes", days_left: 5 }]);
    await openDashboard(page);
    await expect(card(page, "Tomatoes").getByRole("button", { name: /as opened/ })).toHaveCount(0);
  });

  test("a pack scanned after its printed date keeps that date and says how long ago it was", async ({ backend, page }) => {
    backend.api["scan-expiry-date"] = {
      body: {
        success: true,
        expiry: { days_left: 0, expiry_date: daysAgo(10), source: "printed_expiry", confidence: "high", raw_text_found: "BEST BEFORE", date_kind: "best_before", notes: [] },
      },
    };
    await openDashboard(page);
    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await page.getByPlaceholder("e.g., 8901234567890").fill("8901262010023");
    await page.getByRole("button", { name: "Use", exact: true }).click();

    const result = page.getByRole("dialog");
    await result.getByRole("button", { name: "Scan the date on the pack" }).click();
    await page.getByLabel("Upload expiry date photo").setInputFiles(jpeg("date.jpg"));
    await expect(result.getByText("Its date has passed")).toBeVisible();
    await result.getByRole("button", { name: "Add to My Pantry" }).click();

    // days_left cannot go below 0; the date itself is what keeps it past.
    await expect.poll(() => backend.tables.pantry_items[0]?.expiry_date).toBe(daysAgo(10));
    const c = card(page, "Amul Salted Butter 100 g");
    await expect(c.getByText(/Best before .+, 10 days ago/)).toBeVisible();
    await expect(c.getByText("days past", { exact: true })).toBeVisible();
  });
});
