import { expect, test } from "./fixtures";
import { sessionFor, TEST_USER } from "./support/fake-backend";

test.describe("forgotten password: asking for a link", () => {
  test("sends a reset link for the typed email that returns to /reset-password", async ({ anonymous, page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();

    await page.getByPlaceholder("name@example.com").fill("  Asha@Example.test ");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText(/If an account uses/)).toBeVisible();
    const sent = anonymous.requests.find((r) => r.method === "POST" && r.path === "/auth/v1/recover");
    expect(sent?.body).toMatchObject({ email: "asha@example.test" });
    expect(decodeURIComponent(sent!.query)).toContain("/reset-password");
  });

  test("checks the email before sending anything", async ({ anonymous, page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    const email = page.getByPlaceholder("name@example.com");
    await email.fill("asha");
    await page.getByRole("button", { name: "Send reset link" }).click();

    // A type="email" field: the browser itself refuses "asha" before the form submits.
    expect(await email.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    expect(anonymous.requests.some((r) => r.path === "/auth/v1/recover")).toBe(false);
  });

  test("goes back to sign in without sending", async ({ anonymous, page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByRole("button", { name: "Back to sign in" }).click();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    expect(anonymous.requests.some((r) => r.path === "/auth/v1/recover")).toBe(false);
  });
});

test.describe("forgotten password: the reset page", () => {
  // The link signs the person in; the `backend` fixture is that state.
  test("saves the new password and opens the pantry", async ({ backend, page }) => {
    await page.goto("/reset-password");
    await page.getByLabel("New password", { exact: true }).fill("NewPantry2026");
    await page.getByLabel("Type it again").fill("NewPantry2026");
    await page.getByRole("button", { name: "Save new password" }).click();

    await expect(page).toHaveURL(/\/$/);
    const update = backend.requests.find((r) => r.method === "PUT" && r.path === "/auth/v1/user");
    expect(update?.body).toMatchObject({ password: "NewPantry2026" });
  });

  test("refuses a weak password or two that differ, and saves nothing", async ({ backend, page }) => {
    await page.goto("/reset-password");
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Type it again").fill("short");
    await page.getByRole("button", { name: "Save new password" }).click();
    // Filtered: Next.js's route announcer is a role="alert" too.
    await expect(page.getByRole("alert").filter({ hasText: /at least 8 characters/ })).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill("NewPantry2026");
    await page.getByLabel("Type it again").fill("NewPantry2027");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /don't match/ })).toBeVisible();

    expect(backend.requests.some((r) => r.method === "PUT" && r.path === "/auth/v1/user")).toBe(false);
  });

  test("says when the link has expired, instead of showing a form", async ({ anonymous, page }) => {
    void anonymous;
    await page.goto("/reset-password");
    await expect(page.getByText(/expired or has already been used/)).toBeVisible();
    await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  });

  test("a reset link that lands on the home page goes on to the reset page", async ({ anonymous, page }) => {
    void anonymous;
    const s = sessionFor(TEST_USER);
    const hash = new URLSearchParams({
      access_token: s.access_token,
      expires_at: String(s.expires_at),
      expires_in: String(s.expires_in),
      refresh_token: s.refresh_token,
      token_type: "bearer",
      type: "recovery",
    });
    await page.goto(`/#${hash}`);

    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  });
});
