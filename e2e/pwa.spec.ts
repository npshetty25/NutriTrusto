import { expect, test } from "@playwright/test";

/**
 * Installability and service-worker behaviour, with the worker allowed (the
 * `pwa` project). These run against the same production build; the offline
 * fallback itself needs a server that can be taken down, so it is verified by
 * docs/audit/verify-phase1.mjs rather than here.
 */
test.describe("installable web app", () => {
  test("serves a manifest with PNG, maskable and apple-touch icons", async ({ page, request }) => {
    await page.goto("/login");

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifestHref).toBeTruthy();
    const manifest = await (await request.get(manifestHref!)).json();

    expect(manifest).toMatchObject({ display: "standalone", start_url: "/", scope: "/" });
    const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}:${i.purpose ?? "any"}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));

    for (const icon of manifest.icons as Array<{ src: string }>) {
      const res = await request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
    }

    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png$/);
  });

  test("Chrome reports no installability errors", async ({ page, context }) => {
    await page.goto("/login");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();

    const cdp = await context.newCDPSession(page);
    await cdp.send("Page.enable");
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    expect(installabilityErrors).toEqual([]);
  });

  test("the service worker precaches the offline page", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    const cached = await page.evaluate(async () => {
      for (const key of await caches.keys()) {
        if (await (await caches.open(key)).match("/offline.html")) return key;
      }
      return null;
    });
    expect(cached).toMatch(/^nutri-trust-shell-/);
  });

  test("the offline page is self-contained and keeps a 44px retry button", async ({ page }) => {
    await page.goto("/offline.html");
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    const box = await page.getByRole("button", { name: "Try again" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
