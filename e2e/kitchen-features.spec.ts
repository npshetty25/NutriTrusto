import type { Page } from "@playwright/test";
import { expect, jpeg, openDashboard, openProfileMenu, test } from "./fixtures";

const openAddMenu = async (page: Page) => {
  await page.getByRole("button", { name: /^Add product$/ }).click();
};

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

test.describe("leftovers", () => {
  test("saves cooked food with a 3-day date when it went in the fridge", async ({ backend, page }) => {
    await openDashboard(page);
    await openAddMenu(page);
    await page.getByRole("button", { name: /^Leftovers/ }).click();

    const dialog = page.getByRole("dialog", { name: "Save leftovers" });
    await dialog.getByLabel("What is left").fill("dal tadka");
    await expect(dialog.getByText("Keeps 3 days")).toBeVisible();
    await dialog.getByRole("button", { name: "Add to pantry" }).click();

    await expect(page.getByRole("heading", { level: 3, name: "Leftover dal tadka" })).toBeVisible();
    expect(backend.tables.pantry_items[0]).toMatchObject({ name: "Leftover dal tadka", days_left: 3, expiry_source: "user", storage: "fridge" });
    // Not given the raw ingredient's "Opened it".
    await expect(page.getByRole("button", { name: /Mark Leftover dal tadka as opened/ })).toHaveCount(0);
  });

  test("refuses food that sat out for over two hours, and says why", async ({ backend, page }) => {
    await openDashboard(page);
    await openAddMenu(page);
    await page.getByRole("button", { name: /^Leftovers/ }).click();

    const dialog = page.getByRole("dialog", { name: "Save leftovers" });
    await dialog.getByLabel("What is left").fill("rice");
    await dialog.getByRole("button", { name: "Yes", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("not safe to keep");
    await expect(dialog.getByRole("button", { name: "Add to pantry" })).toBeDisabled();
    expect(backend.tables.pantry_items).toHaveLength(0);
  });
});

test.describe("photo of produce", () => {
  test("names what is in the photo, and adds only what is ticked", async ({ backend, page }) => {
    backend.api["scan-produce"] = { body: { success: true, items: ["Tomatoes", "Bhindi (Okra)", "Bananas"] } };
    await openDashboard(page);
    await openAddMenu(page);
    await page.getByRole("button", { name: /^Photo of produce/ }).click();

    const dialog = page.getByRole("dialog", { name: "Photo of fresh produce" });
    await dialog.getByLabel("Choose a photo of produce").setInputFiles(jpeg("veg.jpg"));
    await expect(dialog.getByRole("checkbox", { name: "Tomatoes" })).toBeChecked();
    await dialog.getByRole("checkbox", { name: "Bananas" }).click();
    await dialog.getByRole("button", { name: "Add 2 items to pantry" }).click();

    await expect.poll(() => backend.tables.pantry_items.map((r) => r.name).sort()).toEqual(["Bhindi (Okra)", "Tomatoes"]);
    expect(backend.tables.pantry_items.every((r) => Number(r.days_left) > 0)).toBe(true);
  });

  test("says so when it cannot see any food, instead of adding anything", async ({ backend, page }) => {
    backend.api["scan-produce"] = { body: { success: true, items: [] } };
    await openDashboard(page);
    await openAddMenu(page);
    await page.getByRole("button", { name: /^Photo of produce/ }).click();
    const dialog = page.getByRole("dialog", { name: "Photo of fresh produce" });
    await dialog.getByLabel("Choose a photo of produce").setInputFiles(jpeg("empty.jpg"));
    await expect(dialog.getByRole("alert")).toContainText("couldn't see any food");
    expect(backend.tables.pantry_items).toHaveLength(0);
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

test.describe("kitchen temperature", () => {
  test("is saved to the account from the profile menu", async ({ backend, page }) => {
    await openDashboard(page);
    await openProfileMenu(page);
    await page.getByRole("group", { name: "Kitchen temperature" }).getByRole("button", { name: "Hot" }).click();
    await expect.poll(() => backend.user.user_metadata.kitchen_temp).toBe("hot");
    await expect(page.getByRole("group", { name: "Kitchen temperature" }).getByRole("button", { name: "Hot" })).toHaveAttribute("aria-pressed", "true");
  });
});
