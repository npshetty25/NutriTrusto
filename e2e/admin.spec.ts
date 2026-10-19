import { expect, openDashboard, test } from "./fixtures";

/**
 * "Add Demo Data" is a UI convenience for the project owner, not a security
 * boundary (see src/lib/admin.ts) — it is gated purely so an ordinary user
 * never sees a button that fills their real pantry with sample groceries.
 */
test.describe("admin-only Add Demo Data button", () => {
  test("is hidden for an ordinary signed-in user, in both the filter panel and the empty state", async ({ backend, page }) => {
    void backend;
    await openDashboard(page);
    await expect(page.getByRole("button", { name: "Add Demo Data" })).toHaveCount(0);

    // Open the filter panel, which holds the other copy of the button.
    await page.getByTitle("Filter and sort").click();
    await expect(page.getByRole("button", { name: "Add Demo Data" })).toHaveCount(0);
  });

  test("is visible, and works, for the admin email", async ({ adminBackend, page }) => {
    await openDashboard(page);
    await expect(page.getByRole("button", { name: "Add Demo Data" })).toBeVisible();

    await page.getByRole("button", { name: "Add Demo Data" }).click();
    await expect.poll(() => adminBackend.tables.pantry_items.length).toBeGreaterThan(0);
  });
});
