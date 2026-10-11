import { expect, openProfileMenu, test } from "./fixtures";

test.describe("authentication", () => {
  test("a signed-out visitor to the dashboard is sent to the login page", async ({ anonymous, page }) => {
    void anonymous;
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Nutri-Trust" })).toBeVisible();
  });

  test("signs in with a password and lands on an empty pantry", async ({ anonymous, page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("name@example.com").fill("asha@example.test");
    await page.getByPlaceholder("••••••••").fill("correct horse battery");
    await page.locator('form button[type="submit"]').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Your pantry is empty" })).toBeVisible();

    const tokenCall = anonymous.requests.find((r) => r.path === "/auth/v1/token");
    expect(tokenCall?.body).toMatchObject({ email: "asha@example.test", password: "correct horse battery" });
  });

  test("shows the server's reason for a failed sign-in and stays on the login page", async ({ anonymous, page }) => {
    void anonymous;
    await page.goto("/login");
    await page.getByPlaceholder("name@example.com").fill("wrong@example.test");
    await page.getByPlaceholder("••••••••").fill("nope");
    await page.locator('form button[type="submit"]').click();

    await expect(page.getByText("Invalid login credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("toggles password visibility", async ({ anonymous, page }) => {
    void anonymous;
    await page.goto("/login");
    const field = page.getByPlaceholder("••••••••");
    await field.fill("secret");
    await expect(field).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(field).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(field).toHaveAttribute("type", "password");
  });

  test("sign-up sends the profile and asks the user to confirm their e-mail", async ({ anonymous, page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign Up" }).click();
    await page.getByPlaceholder("Alex Smith").fill("Asha Rao");
    await page.getByPlaceholder("name@example.com").fill("asha@example.test");
    await page.getByPlaceholder("••••••••").fill("correct horse battery");
    await page.locator('form button[type="submit"]').click();

    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    const signup = anonymous.requests.find((r) => r.path === "/auth/v1/signup");
    expect(signup?.body).toMatchObject({
      email: "asha@example.test",
      data: { full_name: "Asha Rao" },
    });
  });

  test("a signed-in user can sign out and is returned to the login page", async ({ backend, page }) => {
    void backend;
    await page.goto("/");
    await openProfileMenu(page);
    await page.getByRole("menuitem", { name: /Sign Out/ }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
