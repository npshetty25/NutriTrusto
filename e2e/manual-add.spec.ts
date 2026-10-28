import { expect, openDashboard, test } from "./fixtures";

/** Today + n as YYYY-MM-DD in the browser's own calendar, for a date input. */
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const lastInsert = (backend: { sent: (m: string, t: string) => { body: unknown }[] }) => {
  const sent = backend.sent("POST", "pantry_items");
  return (sent[sent.length - 1]?.body as Record<string, unknown>[] | undefined)?.[0];
};

test.describe("add an item by hand", () => {
  test("estimates the days when no date is given, and says so before saving", async ({ backend, page }) => {
    await openDashboard(page);
    await page.getByRole("button", { name: "Add an item by hand" }).click();

    const dialog = page.getByRole("dialog", { name: "Add an item" });
    await dialog.getByLabel("Name").fill("Paneer");
    await expect(dialog.getByText(/Will show \d+ days? left/)).toBeVisible();
    await dialog.getByRole("button", { name: "Add to pantry" }).click();

    await expect(page.getByRole("heading", { level: 3, name: "Paneer" })).toBeVisible();
    expect(lastInsert(backend)).toMatchObject({ name: "Paneer", expiry_source: null, opened_at: null });
  });

  test("a date typed from the pack beats the estimate and is marked as the person's", async ({ backend, page }) => {
    await openDashboard(page);
    await page.getByRole("button", { name: "Add an item by hand" }).click();

    const dialog = page.getByRole("dialog", { name: "Add an item" });
    await dialog.getByLabel("Name").fill("Amul Taaza Milk");
    await dialog.locator('input[type="date"]').fill(inDays(10));
    await expect(dialog.getByText("Will show 10 days left")).toBeVisible();
    await dialog.getByRole("button", { name: "Add to pantry" }).click();

    await expect(page.getByText("Date set by you")).toBeVisible();
    expect(lastInsert(backend)).toMatchObject({ name: "Amul Taaza Milk", days_left: 10, expiry_source: "user" });
  });

  test("an opened pack never keeps longer than its 'use within' days", async ({ backend, page }) => {
    await openDashboard(page);
    await page.getByRole("button", { name: "Add an item by hand" }).click();

    const dialog = page.getByRole("dialog", { name: "Add an item" });
    await dialog.getByLabel("Name").fill("Toor Dal");
    await dialog.getByRole("button", { name: "Yes, opened" }).click();
    await dialog.getByRole("button", { name: "2d", exact: true }).click();
    await expect(dialog.getByText("Will show 2 days left")).toBeVisible();
    await dialog.getByRole("button", { name: "Add to pantry" }).click();

    await expect.poll(() => lastInsert(backend)?.days_left).toBe(2);
    expect(lastInsert(backend)?.opened_at).toBeTruthy();
  });

  test("a typed date that has already passed is kept, and the card counts the days since", async ({ backend, page }) => {
    await openDashboard(page);
    await page.getByRole("button", { name: "Add an item by hand" }).click();

    const dialog = page.getByRole("dialog", { name: "Add an item" });
    await dialog.getByLabel("Name").fill("Mango Pickle");
    await dialog.locator('input[type="date"]').fill(inDays(-5));
    await expect(dialog.getByText("Its date has already passed")).toBeVisible();
    await dialog.getByRole("button", { name: "Add to pantry" }).click();

    await expect.poll(() => lastInsert(backend)?.expiry_date).toBe(inDays(-5));
    await expect(page.getByText(/Your date .+, 5 days ago/)).toBeVisible();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Its date passed 5 days ago");
  });

  test("a pack opened before its date keeps the use-within limit, not the pack's date", async ({ backend, page }) => {
    await openDashboard(page);
    await page.getByRole("button", { name: "Add an item by hand" }).click();

    const dialog = page.getByRole("dialog", { name: "Add an item" });
    await dialog.getByLabel("Name").fill("Amul Taaza Milk");
    await dialog.locator('input[type="date"]').fill(inDays(60));
    await dialog.getByRole("button", { name: "Yes, opened" }).click();
    await dialog.getByRole("button", { name: "3d", exact: true }).click();
    await expect(dialog.getByText("Will show 3 days left")).toBeVisible();
    await dialog.getByRole("button", { name: "Add to pantry" }).click();

    // Stored with the pack's date, the next fetch would count 60 days again.
    await expect.poll(() => lastInsert(backend)?.days_left).toBe(3);
    expect(lastInsert(backend)).toMatchObject({ expiry_date: null, expiry_source: null, expiry_kind: null });
  });

  test("refuses an item the account's diet would hide, and says why", async ({ backend, page }) => {
    void backend; // the default account is vegetarian
    await openDashboard(page);
    await page.getByRole("button", { name: "Add an item by hand" }).click();

    const dialog = page.getByRole("dialog", { name: "Add an item" });
    await dialog.getByLabel("Name").fill("Chicken Breast");
    await expect(dialog.getByRole("alert")).toContainText("doesn't fit your vegetarian diet");
    await expect(dialog.getByRole("button", { name: "Add to pantry" })).toBeDisabled();
  });
});

test.describe("reaching add-by-hand from the bottom bar", () => {
  test("the bottom button is 'Add product' and its menu offers the form", async ({ backend, page }) => {
    void backend;
    await openDashboard(page);
    await page.getByRole("button", { name: /^Add product$/ }).click();
    await page.getByRole("button", { name: /^Add product Scan a barcode/ }).click();
    await expect(page.getByRole("dialog", { name: "Add an item" })).toBeVisible();
  });

  test("scanning a barcode fills in the product's name, and the date is still typed by hand", async ({ backend, page }) => {
    await openDashboard(page);
    await page.getByRole("button", { name: "Add an item by hand" }).click();
    await page.getByRole("dialog", { name: "Add an item" }).getByRole("button", { name: "Scan barcode" }).click();

    // The scanner's own manual-code box stands in for the camera in tests.
    await page.getByPlaceholder("e.g., 8901234567890").fill("8901262010023");
    await page.getByRole("button", { name: "Use", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Add an item" });
    await expect(dialog.getByLabel("Name")).toHaveValue("Amul Salted Butter");
    await dialog.locator('input[type="date"]').fill(inDays(20));
    await expect(dialog.getByText("Will show 20 days left")).toBeVisible();
    await dialog.getByRole("button", { name: "Add to pantry" }).click();

    await expect.poll(() => lastInsert(backend)).toMatchObject({ days_left: 20, expiry_source: "user" });
  });
});

test.describe("editing what the person knows about an item", () => {
  test("marking an item opened shortens it to the pack's 'use within' days", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Curd", days_left: 6 }]);
    await openDashboard(page);

    await page.getByRole("button", { name: "Edit Curd" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Yes, opened" }).click();
    await dialog.getByRole("button", { name: "3d", exact: true }).click();
    await dialog.getByRole("button", { name: "Save Changes" }).click();

    await expect.poll(() => backend.tables.pantry_items[0].days_left).toBe(3);
    expect(backend.tables.pantry_items[0].opened_at).toBeTruthy();
    await expect(page.getByText(/^Opened /)).toBeVisible();
  });
});
