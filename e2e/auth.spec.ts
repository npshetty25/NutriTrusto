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

    await expect(page.getByText("Wrong email or password.")).toBeVisible();
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
    await page.getByPlaceholder("••••••••").fill("pantry2026");
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

test.describe("sign-up and sign-in checks", () => {
  const openSignUp = async (page: import("@playwright/test").Page) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign Up" }).click();
  };
  const submit = (page: import("@playwright/test").Page) => page.locator('form button[type="submit"]').click();
  const sentSignUp = (b: import("./support/fake-backend").FakeBackend) => b.requests.some((r) => r.path === "/auth/v1/signup");

  test("rejects a made-up email address without contacting the server", async ({ anonymous, page }) => {
    await openSignUp(page);
    await page.getByPlaceholder("Alex Smith").fill("Asha Rao");
    await page.getByPlaceholder("name@example.com").fill("abc@xyz");
    await page.getByPlaceholder("••••••••").fill("pantry2026");
    await submit(page);
    await expect(page.getByText("That doesn't look like a valid email address.")).toBeVisible();
    expect(sentSignUp(anonymous)).toBe(false);
  });

  test("rejects a weak password and says what is needed", async ({ anonymous, page }) => {
    await openSignUp(page);
    await expect(page.getByText(/At least 8 characters, with a letter and a number/)).toBeVisible();
    await page.getByPlaceholder("Alex Smith").fill("Asha Rao");
    await page.getByPlaceholder("name@example.com").fill("asha@gmail.com");
    await page.getByPlaceholder("••••••••").fill("abcdefgh");
    await submit(page);
    await expect(page.getByText("Use at least one letter and one number.")).toBeVisible();
    expect(sentSignUp(anonymous)).toBe(false);
  });

  test("rejects a name that is not a name", async ({ anonymous, page }) => {
    await openSignUp(page);
    await page.getByPlaceholder("Alex Smith").fill("1234");
    await page.getByPlaceholder("name@example.com").fill("asha@gmail.com");
    await page.getByPlaceholder("••••••••").fill("pantry2026");
    await submit(page);
    await expect(page.getByText(/can only contain letters/)).toBeVisible();
    expect(sentSignUp(anonymous)).toBe(false);
  });

  test("sends the email trimmed and lower-cased", async ({ anonymous, page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("name@example.com").fill("  Asha@Gmail.COM ");
    await page.getByPlaceholder("••••••••").fill("anything");
    await submit(page);
    await expect(page).toHaveURL(/\/$/);
    expect(anonymous.requests.find((r) => r.path === "/auth/v1/token")?.body).toMatchObject({ email: "asha@gmail.com" });
  });

  test("goes straight to the pantry when the project does not require confirmation", async ({ anonymous, page }) => {
    anonymous.autoConfirm = true;
    await openSignUp(page);
    await page.getByPlaceholder("Alex Smith").fill("Asha Rao");
    await page.getByPlaceholder("name@example.com").fill("asha@gmail.com");
    await page.getByPlaceholder("••••••••").fill("pantry2026");
    await submit(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toHaveCount(0);
  });
});
