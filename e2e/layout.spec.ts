import { expect, horizontalOverflow, openDashboard, openProfileMenu, test, undersizedTargets } from "./fixtures";

/**
 * Regression guard for the responsive work (docs/audit/PHASE1_RESULTS.md):
 * no horizontal scroll, and no interactive element under 44px, on a phone.
 * Runs in the `mobile` project only (Pixel 7, 412px wide).
 */
const seed = (backend: import("./support/fake-backend").FakeBackend) => {
  backend.seedPantry([
    { name: "Full Cream Milk 500ml", days_left: 1 },
    { name: "Whole Wheat Bread", days_left: 2 },
    { name: "Paneer 200g", days_left: 3 },
    { name: "Basmati Rice 5kg", days_left: 300 },
  ]);
  backend.seedShopping(["Atta 5kg", "Fresh coriander — 1 bunch"]);
};

test.describe("phone layout", () => {
  test("the login page fits and every control is tappable", async ({ anonymous, page }) => {
    void anonymous;
    await page.goto("/login");
    await expect(page.getByPlaceholder("name@example.com")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await undersizedTargets(page)).toEqual([]);
  });

  test("the dashboard with items fits and every control is tappable", async ({ backend, page }) => {
    seed(backend);
    await openDashboard(page);
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await undersizedTargets(page)).toEqual([]);
  });

  test("a long item name wraps instead of being cut off", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Whole Wheat Multigrain Sandwich Bread 400g", days_left: 2 }]);
    await openDashboard(page);
    const heading = page.getByRole("heading", { level: 3, name: /Multigrain Sandwich Bread/ });
    const truncated = await heading.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(truncated).toBe(false);
  });

  test("the profile menu rows are tappable", async ({ backend, page }) => {
    seed(backend);
    await openDashboard(page);
    await openProfileMenu(page);
    expect(await undersizedTargets(page)).toEqual([]);
  });

  test("the shopping list, including its row controls, is tappable", async ({ backend, page }) => {
    seed(backend);
    await openDashboard(page);
    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: /Shopping List/ }).click();
    await expect(page.getByText("Atta 5kg")).toBeVisible();
    expect(await undersizedTargets(page)).toEqual([]);
  });

  test("the barcode scanner dialog is tappable and its field is 16px", async ({ backend, page }) => {
    seed(backend);
    await openDashboard(page);
    await page.getByRole("button", { name: /Barcode/ }).first().click();
    const field = page.getByPlaceholder("e.g., 8901234567890");
    await expect(field).toBeVisible();
    expect(await undersizedTargets(page)).toEqual([]);
    const px = await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(px).toBeGreaterThanOrEqual(16);
  });

  test("the scan result dialog is tappable", async ({ backend, page }) => {
    seed(backend);
    await openDashboard(page);
    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await page.getByPlaceholder("e.g., 8901234567890").fill("8901262010023");
    await page.getByRole("button", { name: "Use", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await undersizedTargets(page)).toEqual([]);
  });
});
