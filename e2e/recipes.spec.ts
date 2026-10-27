import { expect, test } from "./fixtures";

test.describe("global recipes", () => {
  // Peru has no TheMealDB entry, so these are only our own dishes, which have no photo and need no network.
  test("a dish card shows its placeholder, never the code that chooses one", async ({ backend, page }) => {
    void backend;
    await page.goto("/recipes");
    await page.getByRole("button", { name: /Peru/ }).click();

    await expect(page.getByRole("button", { name: /Quinoa Salad with Avocado/ })).toBeVisible();
    await expect(page.getByText(/strMealThumb/)).toHaveCount(0);
    // No photo means no <img> at all: it used to render an empty one beside the placeholder.
    await expect(page.locator("main main img")).toHaveCount(0);

    await page.getByRole("button", { name: /Quinoa Salad with Avocado/ }).click();
    await expect(page.getByRole("heading", { name: /Quinoa Salad with Avocado/ })).toBeVisible();
    await expect(page.getByText(/strMealThumb/)).toHaveCount(0);
  });
});
