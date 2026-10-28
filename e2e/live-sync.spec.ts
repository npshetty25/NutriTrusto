import type { Page } from "@playwright/test";
import { expect, openDashboard, openProfileMenu, test } from "./fixtures";
import type { FakeBackend } from "./support/fake-backend";

// The page's real supabase-js realtime client, against fake-backend's liveRealtime server.
test.use({ liveRealtime: true });

const HOUSEMATE = "00000000-0000-4000-8000-00000000000b";

/** A row a housemate added, reaching this page the way it would: written to the database, then announced by Realtime. */
function housemateAdds(backend: FakeBackend, name: string) {
  backend.seedPantry([{ name, days_left: 4, user_id: HOUSEMATE }]);
  backend.pushChange("pantry_items", "INSERT", backend.tables.pantry_items[backend.tables.pantry_items.length - 1]);
}

/** Subscribed `joins` times and done loading, so from here only a live update can bring a new row in. */
async function settled(page: Page, backend: FakeBackend, joins: number) {
  await expect.poll(() => backend.realtimeJoins.length).toBe(joins);
  await expect(page.getByText("Loading…")).toHaveCount(0);
}

test.describe("live updates", () => {
  test("a housemate's new item appears without a reload", async ({ backend, page }) => {
    await openDashboard(page);
    await settled(page, backend, 1);

    housemateAdds(backend, "Bob's Curd");
    await expect(page.getByRole("heading", { level: 3, name: "Bob's Curd" })).toBeVisible();
  });

  test("keep arriving after a household change restarts the subscription", async ({ backend, page }) => {
    await openDashboard(page);
    await settled(page, backend, 1);

    // Creating a household changes which rows this person can see, so the pantry's subscription restarts.
    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: "Household Settings" }).click();
    await page.getByRole("button", { name: "Create a Household" }).click();
    await settled(page, backend, 2);
    await page.getByRole("button", { name: "Close household settings" }).click();

    housemateAdds(backend, "Bob's Curd");
    await expect(page.getByRole("heading", { level: 3, name: "Bob's Curd" })).toBeVisible();
  });

  test("coming back to the app neither reloads the pantry nor restarts the subscription", async ({ backend, page }) => {
    await openDashboard(page);
    await settled(page, backend, 1);
    const pantryReads = () => backend.requests.filter((r) => r.method === "GET" && r.path === "/rest/v1/pantry_items").length;
    const before = pantryReads();

    // A quick switch to another app and back. The event bubbles, as a real one does, to supabase-js's window listener.
    for (const state of ["hidden", "visible"] as const) {
      await page.evaluate((s) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => s });
        document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
      }, state);
    }
    // supabase-js now re-announces the stored session; give a re-render the time it would need to show up.
    await page.waitForTimeout(1500);

    expect(pantryReads()).toBe(before);
    expect(backend.realtimeJoins).toHaveLength(1);
  });
});
