import { expect, openDashboard, test } from "./fixtures";

/**
 * The account's diet is a hard scope on what the app shows, not a chip that
 * can be tapped away. These run against the whole page: the unit tests prove
 * the rule (src/lib/diet.test.ts); this proves every surface actually uses it.
 *
 * The fake backend does not model row-level security, so what is proved here
 * is what the UI does with rows it was handed, not what the database returns.
 */
const MIXED = [
  { name: "Palak (Spinach)", days_left: 4 },
  { name: "Eggs", days_left: 2 },
  { name: "Chicken Breast", days_left: 1 },
];

test.describe("vegetarian account (the default)", () => {
  test("sees only vegetarian items, and the header count agrees with the list", async ({ backend, page }) => {
    backend.seedPantry(MIXED);
    await openDashboard(page);

    await expect(page.getByRole("heading", { name: "Palak (Spinach)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Eggs", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Chicken Breast" })).toHaveCount(0);
    // The regression: the header used to say "3 items" over a list of one.
    await expect(page.getByText(/1 item, nothing urgent|1 item needs/)).toBeVisible();
  });

  test("has no diet chips to widen the view back to everything", async ({ backend, page }) => {
    backend.seedPantry(MIXED);
    await openDashboard(page);
    await page.getByTitle("Filter and sort").click();
    await expect(page.getByRole("group", { name: "Filter by diet" })).toHaveCount(0);
    // The other filters are still there.
    await expect(page.getByLabel("Sort by")).toBeVisible();
  });

  test("an item in the pantry that the diet hides says 'empty', not 'nothing matches'", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Chicken Breast", days_left: 1 }]);
    await openDashboard(page);
    await expect(page.getByRole("heading", { name: "Your pantry is empty" })).toBeVisible();
  });
});

test.describe("eggtarian account", () => {
  test.use({ diet: "eggtarian" });

  test("sees egg but no meat", async ({ backend, page }) => {
    backend.seedPantry(MIXED);
    await openDashboard(page);
    await expect(page.getByRole("heading", { name: "Eggs", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Palak (Spinach)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chicken Breast" })).toHaveCount(0);
    await expect(page.getByText(/2 items/)).toBeVisible();
  });
});

test.describe("non-vegetarian account", () => {
  test.use({ diet: "non-veg" });

  test("sees everything and keeps the diet chips", async ({ backend, page }) => {
    backend.seedPantry(MIXED);
    await openDashboard(page);
    await expect(page.getByRole("heading", { name: "Chicken Breast" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Eggs", exact: true })).toBeVisible();
    await expect(page.getByText(/3 items/)).toBeVisible();

    await page.getByTitle("Filter and sort").click();
    await expect(page.getByRole("group", { name: "Filter by diet" })).toBeVisible();
    await page.getByRole("button", { name: "Veg", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Chicken Breast" })).toHaveCount(0);
  });
});

test.describe("an account with no diet yet (a fresh Google sign-in)", () => {
  test.use({ diet: "" });

  test("asks how they eat before anything else, and the tour waits", async ({ freshBackend, page }) => {
    void freshBackend;
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: "How do you eat?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome to Nutri-Trust" })).toHaveCount(0);
  });

  test("saves the answer to the account, then hands over to the tour", async ({ freshBackend, page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Eggtarian/ }).click();

    await expect(page.getByRole("dialog", { name: "How do you eat?" })).toHaveCount(0);
    expect(freshBackend.user.user_metadata.dietary_preference).toBe("eggtarian");
    await expect(page.getByRole("heading", { name: "Welcome to Nutri-Trust" })).toBeVisible();
  });
});

test.describe("an account that already has a diet", () => {
  test("is never asked", async ({ backend, page }) => {
    void backend;
    await openDashboard(page);
    await expect(page.getByRole("dialog", { name: "How do you eat?" })).toHaveCount(0);
  });
});
