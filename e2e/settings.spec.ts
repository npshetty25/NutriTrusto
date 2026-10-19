import { expect, openDashboard, openProfileMenu, test } from "./fixtures";

/**
 * End-to-end proof that these two menu items are real features, not the
 * "Coming Soon" toast they used to be: opening each modal, saving a change
 * through the fake backend's PUT /auth/v1/user, and seeing it take effect
 * (both in the modal's own confirmation and, for notifications, in the
 * underlying user_metadata).
 */
test.describe("Notification Preferences", () => {
  // Not tested here: surviving a reload. That needs the fake session in
  // localStorage to reflect the update, but context.addInitScript() reseeds
  // it fresh on every navigation (by design — it's how a signed-in context
  // is set up at all), stomping the very change this would be proving. The
  // real client does persist it (supabase-js writes the updated user back to
  // its own localStorage key on every updateUser() call) — only this fake
  // harness can't observe that across a reload. What IS proven: the toggle
  // calls Supabase and the real backend state changes.
  test("turning reminders off calls Supabase and updates the stored preference", async ({ backend, page }) => {
    await openDashboard(page);
    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: /Notification Preferences/ }).click();

    await expect(page.getByRole("heading", { name: "Notification Preferences" })).toBeVisible();
    await expect(page.getByRole("button", { name: "On", exact: true })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Off", exact: true }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    await expect.poll(() => backend.user.user_metadata.notifications_enabled).toBe(false);
  });

  test("changes how many days before expiry it warns", async ({ backend, page }) => {
    await openDashboard(page);
    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: /Notification Preferences/ }).click();
    await page.getByRole("button", { name: "7d", exact: true }).click();
    await expect.poll(() => backend.user.user_metadata.notify_days_before).toBe(7);
  });
});

test.describe("Account Settings", () => {
  test("changes the display name", async ({ backend, page }) => {
    await openDashboard(page);
    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: /Account Settings/ }).click();

    await expect(page.getByRole("heading", { name: "Account Settings" })).toBeVisible();
    const nameField = page.getByPlaceholder("Your name");
    await nameField.fill("Asha K Rao");
    await page.getByRole("button", { name: "Save" }).first().click();

    await expect.poll(() => backend.user.user_metadata.full_name).toBe("Asha K Rao");
  });

  test("rejects an invalid new password without touching the account", async ({ backend, page }) => {
    await openDashboard(page);
    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: /Account Settings/ }).click();

    await page.getByPlaceholder("New password", { exact: true }).fill("short");
    await page.getByPlaceholder("Confirm new password").fill("short");
    await page.getByRole("button", { name: "Save" }).nth(2).click();

    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    expect(backend.requests.some((r) => r.path === "/auth/v1/user" && r.method === "PUT")).toBe(false);
  });

  test("offers account deletion as a mailto request, not a self-service delete", async ({ backend, page }) => {
    void backend;
    await openDashboard(page);
    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: /Account Settings/ }).click();

    const link = page.getByRole("link", { name: /Request Account Deletion/ });
    await expect(link).toHaveAttribute("href", /^mailto:/);
  });
});
