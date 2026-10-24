import { expect, test } from "./fixtures";

/**
 * My recipes: write one, favourite it, and see the vegetarian warning. The
 * unit tests in src/lib/custom-recipes.test.ts cover the rules; this proves
 * the page uses them.
 */
test.describe("my recipes", () => {
  test("writes a recipe, saves it, and favourites it", async ({ backend, page }) => {
    await page.goto("/recipes");
    await page.getByRole("tab", { name: "My recipes" }).click();
    await expect(page.getByText("No recipes of your own yet")).toBeVisible();

    await page.getByRole("button", { name: "New recipe" }).click();
    const dialog = page.getByRole("dialog", { name: "New recipe" });
    await dialog.getByLabel("Name").fill("Amma's dal");
    await dialog.getByLabel("Ingredients").fill("200 g toor dal\n1 onion");
    await dialog.getByLabel("Steps").fill("Pressure-cook the dal.\nFry the onion.");
    await dialog.getByRole("button", { name: "Save recipe" }).click();

    await expect(page.getByText("Amma's dal", { exact: true })).toBeVisible();
    await expect.poll(() => backend.tables.custom_recipes.length).toBe(1);
    expect(backend.tables.custom_recipes[0]).toMatchObject({ name: "Amma's dal" });

    await page.getByRole("button", { name: "Add Amma's dal to favourites" }).click();
    await expect.poll(() => backend.tables.custom_recipes[0].is_favourite).toBe(true);
  });

  test("warns a vegetarian, while typing, that a chicken recipe will be hidden", async ({ backend, page }) => {
    void backend;
    await page.goto("/recipes");
    await page.getByRole("tab", { name: "My recipes" }).click();
    await page.getByRole("button", { name: "New recipe" }).click();

    const dialog = page.getByRole("dialog", { name: "New recipe" });
    await dialog.getByLabel("Ingredients").fill("500 g chicken thigh");
    await expect(dialog.getByRole("status")).toContainText("contains meat or fish");
  });
});
