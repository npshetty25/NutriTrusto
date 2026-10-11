import { expect, openDashboard, openProfileMenu, test } from "./fixtures";
import type { Page } from "@playwright/test";

const openMenuItem = async (page: Page, name: RegExp) => {
  await openProfileMenu(page);
  await page.getByRole("menuitem", { name }).click();
};

test.describe("shopping list", () => {
  test("adds an item, ticks it off, and keeps both across a reload", async ({ backend, page }) => {
    await openDashboard(page);
    await openMenuItem(page, /Shopping List/);

    await expect(page.getByText("Your shopping list is empty.")).toBeVisible();
    await page.getByPlaceholder("Add an item...").fill("Atta 5kg");
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("Atta 5kg")).toBeVisible();
    expect(backend.tables.shopping_list_items).toHaveLength(1);

    await page.getByRole("button", { name: "Mark as bought" }).click();
    await expect.poll(() => backend.tables.shopping_list_items[0].checked).toBe(true);

    await page.reload();
    await openMenuItem(page, /Shopping List/);
    await expect(page.getByText("Atta 5kg")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark as not bought" })).toBeVisible();
  });

  test("removes an item", async ({ backend, page }) => {
    backend.seedShopping(["Milk", "Eggs"]);
    await openDashboard(page);
    await openMenuItem(page, /Shopping List/);

    const row = page.getByText("Milk").locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    await row.getByRole("button", { name: "Remove item" }).click();
    await expect(page.getByText("Milk")).toHaveCount(0);
    await expect.poll(() => backend.tables.shopping_list_items.map((r) => r.name)).toEqual(["Eggs"]);
  });

  test("clears checked items in one go", async ({ backend, page }) => {
    backend.seedShopping(["Milk", "Eggs", "Atta"]);
    backend.tables.shopping_list_items[0].checked = true;
    backend.tables.shopping_list_items[2].checked = true;
    await openDashboard(page);
    await openMenuItem(page, /Shopping List/);

    await page.getByRole("button", { name: "Clear checked items" }).click();
    await expect.poll(() => backend.tables.shopping_list_items.map((r) => r.name)).toEqual(["Eggs"]);
  });
});

test.describe("household", () => {
  test("creates a household and shows its invite code", async ({ backend, page }) => {
    await openDashboard(page);
    await openMenuItem(page, /Household Settings/);

    await page.getByRole("button", { name: /Create a Household/ }).click();
    await expect(page.getByText("Asha Rao's Household")).toBeVisible();
    const code = backend.tables.households[0].invite_code as string;
    await expect(page.getByText(code)).toBeVisible();
    expect(backend.tables.household_members).toHaveLength(1);
  });

  test("joins an existing household with its code", async ({ backend, page }) => {
    backend.tables.households.push({ id: "h-existing", name: "Rao family", invite_code: "abc123def456", created_by: "someone-else" });
    await openDashboard(page);
    await openMenuItem(page, /Household Settings/);

    await page.getByPlaceholder("Enter invite code").fill("abc123def456");
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page.getByText("Rao family")).toBeVisible();
  });

  test("an unknown invite code is rejected with a clear message", async ({ backend, page }) => {
    void backend;
    await openDashboard(page);
    await openMenuItem(page, /Household Settings/);

    await page.getByPlaceholder("Enter invite code").fill("not-a-real-code");
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page.getByText("Invalid invite code. Double-check and try again.")).toBeVisible();
  });
});
