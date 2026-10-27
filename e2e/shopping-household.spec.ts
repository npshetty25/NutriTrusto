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
    // In the dialog; the header names the household too once you're in one.
    await expect(page.getByRole("dialog").getByText("Asha Rao's Household")).toBeVisible();
    await expect(page.getByRole("button", { name: /Asha Rao's Household/ })).toBeVisible();
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
    await expect(page.getByRole("dialog").getByText("Rao family")).toBeVisible();
  });

  test("after joining, offers to share the items you already had, and shares them", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Paneer", days_left: 3 }]);
    backend.tables.households.push({ id: "h-rao", name: "Rao family", invite_code: "abc123def456", created_by: "u-ravi" });
    backend.tables.household_members.push({ household_id: "h-rao", user_id: "u-ravi", display_name: "Ravi", joined_at: "2026-10-01T00:00:00Z" });
    await openDashboard(page);
    await openMenuItem(page, /Household Settings/);

    await page.getByPlaceholder("Enter invite code").fill("abc123def456");
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page.getByText("1 item of yours is private")).toBeVisible();
    await expect(page.getByText("Ravi", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Share it with the household/ }).click();
    await expect.poll(() => backend.tables.pantry_items[0].household_id).toBe("h-rao");
    await expect(page.getByText(/of yours (is|are) private/)).toHaveCount(0);
  });

  test("an invite link opens the join dialog with the code filled in", async ({ backend, page }) => {
    void backend;
    await page.goto("/?join=abc123def456");
    await expect(page.getByPlaceholder("Enter invite code")).toHaveValue("abc123def456");
    await expect(page).not.toHaveURL(/join=/);
  });

  test("leaving asks first, then takes your items back to your private pantry", async ({ backend, page }) => {
    backend.tables.households.push({ id: "h-rao", name: "Rao family", invite_code: "abc123def456", created_by: backend.user.id });
    backend.tables.household_members.push({ household_id: "h-rao", user_id: backend.user.id, joined_at: "2026-10-01T00:00:00Z" });
    backend.seedPantry([{ name: "Paneer", days_left: 3 }]);
    backend.tables.pantry_items[0].household_id = "h-rao";
    await openDashboard(page);
    await openMenuItem(page, /Household Settings/);

    await page.getByRole("button", { name: /Leave Household/ }).click();
    await page.getByRole("button", { name: /Yes, leave/ }).click();
    await expect.poll(() => backend.tables.household_members.length).toBe(0);
    expect(backend.tables.pantry_items[0].household_id).toBeNull();
    await expect(page.getByRole("button", { name: /Create a Household/ })).toBeVisible();
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
