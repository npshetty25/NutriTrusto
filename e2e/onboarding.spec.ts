import { expect, openDashboard, openProfileMenu, test } from "./fixtures";

/**
 * Component-level behaviour (steps, Back/Next/Skip/Escape) is covered by
 * src/components/onboarding-tour.test.tsx. This file proves the part that
 * only exists once the real app is wired together: a genuinely first-time
 * sign-in shows it automatically, dismissing it is remembered, and it can be
 * reopened later.
 *
 * Uses the `freshBackend` fixture, not the usual `backend` — every other e2e
 * test wants "a user who has used the app before", so that is what `backend`
 * pre-seeds (see fake-backend.ts's install()); this is the one place that
 * deliberately does not.
 */
test.describe("first-time walkthrough", () => {
  test("shows automatically for a session that has never dismissed it", async ({ freshBackend, page }) => {
    void freshBackend;
    await openDashboard(page);
    await expect(page.getByRole("heading", { name: "Welcome to Nutri-Trust" })).toBeVisible();
  });

  test("finishing it is remembered — it does not come back after a reload", async ({ freshBackend, page }) => {
    void freshBackend;
    await openDashboard(page);
    await page.getByRole("heading", { name: "Welcome to Nutri-Trust" }).waitFor();
    await page.getByRole("button", { name: "Skip tour" }).click();
    await expect(page.getByRole("heading", { name: "Welcome to Nutri-Trust" })).toHaveCount(0);

    await page.reload();
    await page.getByRole("button", { name: /Barcode/ }).first().waitFor();
    await expect(page.getByRole("heading", { name: "Welcome to Nutri-Trust" })).toHaveCount(0);
  });

  test("steps through Receipt, Barcode, then Ask AI, ending on Done", async ({ freshBackend, page }) => {
    void freshBackend;
    await openDashboard(page);
    await page.getByRole("heading", { name: "Welcome to Nutri-Trust" }).waitFor();

    await page.getByRole("button", { name: /Next/ }).click();
    await expect(page.getByRole("heading", { name: "Add products" })).toBeVisible();

    await page.getByRole("button", { name: /Next/ }).click();
    await expect(page.getByRole("heading", { name: "Scan a barcode" })).toBeVisible();

    await page.getByRole("button", { name: /Next/ }).click();
    await expect(page.getByRole("heading", { name: "Ask your pantry anything" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
  });

  test("does not block the rest of the app — skip it, then use the real Barcode button", async ({ freshBackend, page }) => {
    void freshBackend;
    await openDashboard(page);
    await page.getByRole("heading", { name: "Welcome to Nutri-Trust" }).waitFor();
    await page.getByRole("button", { name: "Skip tour" }).click();

    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await expect(page.getByPlaceholder("e.g., 8901234567890")).toBeVisible();
  });
});

test.describe("replaying the tour", () => {
  // Ordinary `backend` here: it starts pre-dismissed (the common case for
  // every other spec file), so this is specifically testing the menu item
  // that brings it back — not the auto-show behaviour, which is covered above.
  test("Show App Tour in the profile menu reopens it on demand", async ({ backend, page }) => {
    void backend;
    await openDashboard(page);
    await expect(page.getByRole("heading", { name: "Welcome to Nutri-Trust" })).toHaveCount(0);

    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: /Show App Tour/ }).click();
    await expect(page.getByRole("heading", { name: "Welcome to Nutri-Trust" })).toBeVisible();
  });
});
