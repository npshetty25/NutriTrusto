import { expect, test } from "./fixtures";

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
    await page.getByPlaceholder("name@example.com").fill("asha");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText(/doesn't look like a valid email/)).toBeVisible();
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
