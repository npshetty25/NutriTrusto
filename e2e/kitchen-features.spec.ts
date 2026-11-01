import { expect, openDashboard, openProfileMenu, test } from "./fixtures";

test.describe("weekly plan", () => {
  test("plans dinners from the pantry and puts what to buy on the shopping list", async ({ backend, page }) => {
    backend.seedPantry([
      { name: "Paneer", days_left: 3 },
      { name: "Spinach", days_left: 3 },
      { name: "Cauliflower", days_left: 5 },
    ]);
    await openDashboard(page);
    await page.getByRole("button", { name: "Plan my week" }).click();

    const dialog = page.getByRole("dialog", { name: "Plan my week" });
    await expect(dialog.getByText("Today")).toBeVisible();
    await expect(dialog.getByText(/^Uses /).first()).toBeVisible();

    const add = dialog.getByRole("button", { name: /^Add \d+ to shopping list$/ });
    if (await add.count()) {
      await add.click();
      await expect.poll(() => backend.tables.shopping_list_items.length).toBeGreaterThan(0);
      expect(backend.tables.shopping_list_items[0]).toMatchObject({ source_recipe: "Weekly plan" });
    }
  });
});

test.describe("food preferences", () => {
  test("saves allergies and Jain food to the account, and flags items against them", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Onions", days_left: 20 }, { name: "Paneer", days_left: 5 }]);
    await openDashboard(page);

    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: "Food preferences" }).click();
    const dialog = page.getByRole("dialog", { name: "Food preferences" });
    await dialog.getByRole("button", { name: "Off", exact: true }).click();
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect.poll(() => backend.user.user_metadata.food_profile).toMatchObject({ jain: true });
    const onions = page.locator(".neu-pressable").filter({ has: page.getByRole("heading", { level: 3, name: "Onions" }) });
    await expect(onions.getByText("Not Jain")).toBeVisible();
    const paneer = page.locator(".neu-pressable").filter({ has: page.getByRole("heading", { level: 3, name: "Paneer" }) });
    await expect(paneer.getByText("Not Jain")).toHaveCount(0);
  });

  test("sends the profile with a recipe request", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Paneer", days_left: 2 }, { name: "Spinach", days_left: 3 }]);
    backend.api["find-recipe"] = { body: { success: false, error: "No recipe in this test." } };
    await openDashboard(page);
    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: "Food preferences" }).click();
    const prefs = page.getByRole("dialog", { name: "Food preferences" });
    await prefs.getByRole("button", { name: "Nuts", exact: true }).click();
    await prefs.getByRole("button", { name: "Save" }).click();
    await expect(prefs).toHaveCount(0);

    await page.getByRole("button", { name: "Find a Recipe" }).click();
    await expect.poll(() => backend.requests.some((r) => r.path === "/api/find-recipe")).toBe(true);
    const sent = JSON.parse(String(backend.requests.find((r) => r.path === "/api/find-recipe")!.body));
    expect(sent.foodProfile).toMatchObject({ allergies: ["nuts"] });
  });
});
