import { expect, jpeg, openDashboard, test } from "./fixtures";

/** A purchase date `n` days back, in this machine's own calendar, as Postgres returns it. */
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("pantry", () => {
  test("shows what is already in the pantry, most urgent first", async ({ backend, page }) => {
    backend.seedPantry([
      { name: "Basmati Rice", days_left: 300 },
      { name: "Paneer", days_left: 2 },
      { name: "Spinach", days_left: 4 },
    ]);
    await openDashboard(page);

    const names = await page.getByRole("heading", { level: 3 }).allInnerTexts();
    expect(names.slice(0, 3)).toEqual(["Paneer", "Spinach", "Basmati Rice"]);
  });

  test("offers a recipe even when nothing in the pantry is close to expiring", async ({ backend, page }) => {
    backend.seedPantry([
      { name: "Basmati Rice", days_left: 300 },
      { name: "Potatoes", days_left: 20 },
      { name: "Onions", days_left: 25 },
    ]);
    backend.api["find-recipe"] = { body: { success: false, error: "No recipe in this test." } };
    await openDashboard(page);

    await expect(page.getByRole("heading", { name: "What can I cook?" })).toBeVisible();
    await page.getByRole("button", { name: "Find a Recipe" }).click();
    await expect.poll(() => backend.requests.filter((r) => r.path === "/api/find-recipe").length).toBe(1);
    const sent = JSON.parse(String(backend.requests.find((r) => r.path === "/api/find-recipe")!.body));
    expect(sent.items.map((i: { name: string }) => i.name)).toEqual(["Potatoes", "Onions", "Basmati Rice"]);
  });

  test("scans a barcode by hand and adds the product to the pantry", async ({ backend, page }) => {
    await openDashboard(page);

    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await page.getByPlaceholder("e.g., 8901234567890").fill("8901262010023");
    await page.getByRole("button", { name: "Use", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Amul Salted Butter 100 g" })).toBeVisible();
    await dialog.getByRole("button", { name: "Add to My Pantry" }).click();

    await expect(page.getByRole("heading", { level: 3, name: "Amul Salted Butter 100 g" })).toBeVisible();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Added");

    const inserted = backend.sent("POST", "pantry_items");
    expect(inserted).toHaveLength(1);
    expect(inserted[0].body).toMatchObject([{ user_id: "00000000-0000-4000-8000-000000000001", name: "Amul Salted Butter 100 g" }]);
    // The analysis score travels with the row rather than being thrown away.
    expect(inserted[0].body).toMatchObject([{ health_score: "3.1" }]);
  });

  test("a product with ingredients but no name asks only for the name, never says Unknown Product", async ({ backend, page }) => {
    backend.off = {
      status: 1,
      code: "8904063200127",
      product: {
        brands: "Haldiram's",
        ingredients_text: "Gram flour, edible vegetable oil, moth flour, salt, spices",
        categories: "Snacks, Salty snacks, Namkeen",
        lc: "hi",
        nutriments: { sodium_100g: 0.9, sugars_100g: 1.2 },
      },
    };
    await openDashboard(page);
    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await page.getByPlaceholder("e.g., 8901234567890").fill("8904063200127");
    await page.getByRole("button", { name: "Use", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Found it, but it has no name" })).toBeVisible();
    await expect(dialog.getByLabel("Product name")).toHaveValue("Haldiram's Namkeen");
    await expect(page.getByText("Unknown Product")).toHaveCount(0);

    await dialog.getByLabel("Product name").fill("Haldiram's Aloo Bhujia");
    await dialog.getByRole("button", { name: /Continue|Analy/ }).click();
    // The real ingredients and nutrition went to the analysis, not placeholders.
    await expect.poll(() => backend.requests.filter((r) => r.path === "/api/analyze-food").length).toBe(1);
    const sent = JSON.parse(String(backend.requests.find((r) => r.path === "/api/analyze-food")!.body));
    expect(sent.ingredients).toContain("Gram flour");
    expect(sent.nutritionData.sugars_g_100g).toBe(1.2);
  });

  test("shows the category the model predicts for a scanned product", async ({ backend, page }) => {
    void backend;
    await openDashboard(page);
    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await page.getByPlaceholder("e.g., 8901234567890").fill("8901262010023");
    await page.getByRole("button", { name: "Use", exact: true }).click();
    await expect(page.getByTestId("scan-category")).toHaveText(/Looks like: dairy · model, 91% sure/);
  });

  test("says plainly when the category is only a keyword guess", async ({ backend, page }) => {
    backend.api["categorize"] = {
      body: { success: true, source: "rules", modelVersion: null, predictions: [{ name: "x", category: "dairy", confidence: null }] },
    };
    await openDashboard(page);
    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await page.getByPlaceholder("e.g., 8901234567890").fill("8901262010023");
    await page.getByRole("button", { name: "Use", exact: true }).click();
    await expect(page.getByTestId("scan-category")).toHaveText(/Looks like: dairy · keyword guess/);
    await expect(page.getByTestId("scan-category")).not.toContainText("%");
  });

  test("shows nothing when the category service is unavailable", async ({ backend, page }) => {
    backend.api["categorize"] = { status: 500, body: { success: false } };
    await openDashboard(page);
    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await page.getByPlaceholder("e.g., 8901234567890").fill("8901262010023");
    await page.getByRole("button", { name: "Use", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("scan-category")).toHaveCount(0);
  });

  test("records the scan in history", async ({ backend, page }) => {
    await openDashboard(page);
    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await page.getByPlaceholder("e.g., 8901234567890").fill("8901262010023");
    await page.getByRole("button", { name: "Use", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Add to My Pantry" }).click();

    await expect.poll(() => backend.tables.scan_history.length).toBeGreaterThan(0);
    expect(backend.tables.scan_history[0]).toMatchObject({ source: "barcode" });
  });

  test("refuses to add a non-food product", async ({ backend, page }) => {
    backend.api["analyze-food"] = { body: { is_food: false, health_score: "1.0", health_grade_text: "Not Food", concerns: [], positives: [], alternatives: [], macronutrients: {} } };
    await openDashboard(page);
    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await page.getByPlaceholder("e.g., 8901234567890").fill("8901262010023");
    await page.getByRole("button", { name: "Use", exact: true }).click();

    await expect(page.getByText(/non-food item/)).toBeVisible();
    expect(backend.sent("POST", "pantry_items")).toHaveLength(0);
  });

  test("reads a receipt photo and adds every line item", async ({ backend, page }) => {
    backend.api["extract"] = {
      body: {
        success: true,
        purchase_date: new Date().toISOString(),
        items: [
          { name: "Full Cream Milk", days_left: 5, risk: "high" },
          { name: "Whole Wheat Bread", days_left: 4, risk: "high" },
          { name: "Basmati Rice", days_left: 365, risk: "low" },
        ],
      },
    };
    await openDashboard(page);

    await page.getByRole("button", { name: /^Add product$/ }).click();
    await page.getByText("Choose from Gallery").click();
    await page.getByTitle("Choose a receipt photo from your gallery").setInputFiles(jpeg());

    await expect(page.getByRole("heading", { level: 3, name: "Full Cream Milk" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Whole Wheat Bread" })).toBeVisible();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Receipt Parsed");
    expect(backend.tables.pantry_items).toHaveLength(3);

    const sent = backend.requests.find((r) => r.path === "/api/extract");
    expect(sent).toBeTruthy();
  });

  test("a receipt that cannot be read shows an error and adds nothing", async ({ backend, page }) => {
    backend.api["extract"] = { status: 500, body: { success: false, error: "Failed to parse receipt" } };
    await openDashboard(page);
    await page.getByRole("button", { name: /^Add product$/ }).click();
    await page.getByText("Choose from Gallery").click();
    await page.getByTitle("Choose a receipt photo from your gallery").setInputFiles(jpeg());

    await expect(page.getByText(/couldn't parse this receipt|Failed to parse receipt/i)).toBeVisible();
    expect(backend.tables.pantry_items).toHaveLength(0);
  });

  test("marking an item used removes it, logs the outcome, and survives a reload", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Paneer", days_left: 2 }, { name: "Rice", days_left: 200 }]);
    await openDashboard(page);

    await page.getByTitle("Mark Paneer as used").click();
    await expect(page.getByRole("heading", { level: 3, name: "Paneer" })).toHaveCount(0);
    await expect.poll(() => backend.tables.item_outcomes.length).toBe(1);
    expect(backend.tables.item_outcomes[0]).toMatchObject({ name: "Paneer", outcome: "used" });

    await page.reload();
    await expect(page.getByRole("heading", { level: 3, name: "Rice" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Paneer" })).toHaveCount(0);
  });

  test("editing an item resets its freshness clock and saves", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Curd", days_left: 6 }]);
    await openDashboard(page);

    await page.getByRole("button", { name: "Edit Curd" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Edit Item" })).toBeVisible();
    await dialog.locator('input[type="number"]').fill("12");
    await dialog.getByRole("button", { name: "Save Changes" }).click();

    await expect.poll(() => backend.tables.pantry_items[0].days_left).toBe(12);
  });

  test("search narrows the list", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Paneer", days_left: 2 }, { name: "Rice", days_left: 200 }]);
    await openDashboard(page);
    await page.getByPlaceholder("Search your pantry…").fill("pan");
    await expect(page.getByRole("heading", { level: 3, name: "Paneer" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Rice" })).toHaveCount(0);
  });

  test("Undo puts a removed item back exactly as it was, and takes the removal out of the record", async ({ backend, page }) => {
    backend.seedPantry([{
      name: "Amul Taaza Milk", days_left: 85, purchase_date: daysAgo(5),
      expiry_source: "printed", expiry_kind: "best_before", storage: "fridge", quantity: "1 litre", ingredients_text: "Toned milk",
    }]);
    await openDashboard(page);

    await page.getByRole("button", { name: "Remove Amul Taaza Milk" }).click();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect.poll(() => backend.tables.item_outcomes.length).toBe(1);
    await page.locator("[data-sonner-toast]").getByRole("button", { name: "Undo" }).click();

    await expect.poll(() => backend.tables.pantry_items.length).toBe(1);
    // days_left is the full life from purchase: 85, not the 80 that were left.
    expect(backend.tables.pantry_items[0]).toMatchObject({
      days_left: 85, purchase_date: daysAgo(5),
      expiry_source: "printed", expiry_kind: "best_before", storage: "fridge", quantity: "1 litre", ingredients_text: "Toned milk",
    });
    await expect.poll(() => backend.tables.item_outcomes.length).toBe(0);
  });

  test("renaming an item that is past its date keeps it past", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Spinach", days_left: 4, purchase_date: daysAgo(7) }]);
    await openDashboard(page);

    await page.getByRole("button", { name: "Edit Spinach" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").first().fill("Palak");
    await dialog.getByRole("button", { name: "Save Changes" }).click();

    await expect.poll(() => backend.tables.pantry_items[0].name).toBe("Palak");
    expect(backend.tables.pantry_items[0].days_left).toBe(4);
    await expect(page.getByText("days past", { exact: true })).toBeVisible();
  });

  test("the notifications panel reads the pantry again each time it opens", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Paneer", days_left: 2 }]);
    await openDashboard(page);

    await page.getByRole("button", { name: "Open notifications" }).click();
    const panel = page.getByRole("dialog", { name: "Needs your attention" });
    await expect(panel.getByText(/Paneer may spoil/)).toBeVisible();
    await page.getByRole("button", { name: "Close notifications" }).click();

    backend.tables.pantry_items = [];
    await page.getByRole("button", { name: "Open notifications" }).click();
    await expect(panel.getByText("All clear")).toBeVisible();
  });

  test("a product Open Food Facts doesn't know is looked up through the signed-in fallback", async ({ backend, page }) => {
    backend.off = { status: 0 };
    backend.api["lookup-upc"] = { body: { items: [{ title: "Parle-G Gold", brand: "Parle", size: "100 g", category: "Biscuits" }] } };
    await openDashboard(page);

    await page.getByRole("button", { name: /Barcode/ }).first().click();
    await page.getByPlaceholder("e.g., 8901234567890").fill("8901719101200");
    await page.getByRole("button", { name: "Use", exact: true }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: /Parle-G Gold/ })).toBeVisible();
    // The real route answers 401 without a token; this fallback used to send none.
    expect(backend.requests.find((r) => r.path === "/api/lookup-upc")?.authorization).toMatch(/^Bearer /);
  });

  test("the pantry chat is told which items are past their date", async ({ backend, page }) => {
    backend.seedPantry([{ name: "Spinach", days_left: 4, purchase_date: daysAgo(7) }]);
    backend.api["pantry-chat"] = { body: { success: true, answer: "Check the spinach before anything else." } };
    await openDashboard(page);

    await page.getByRole("button", { name: /Ask AI/ }).click();
    await page.getByRole("button", { name: "What can I cook tonight?" }).click();
    await expect(page.getByText("Check the spinach before anything else.")).toBeVisible();

    const sent = JSON.parse(String(backend.requests.find((r) => r.path === "/api/pantry-chat")!.body));
    expect(sent.items).toEqual([expect.objectContaining({ name: "Spinach", daysLeft: 0, daysPastEstimate: 3 })]);
  });
});
