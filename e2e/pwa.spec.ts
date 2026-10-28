import { expect, test, type Page } from "@playwright/test";

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

/** A page the worker already controls, as a returning visitor's is, with a marker that a reload would wipe. */
async function controlledPage(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(() => { (window as unknown as { marker?: number }).marker = 1; });
}
// "reloading" while the page is mid-navigation, so a poll waits instead of failing.
const marker = (page: Page) =>
  page.evaluate(() => (window as unknown as { marker?: number }).marker).catch(() => "reloading");
// Fired at once, so an unexpected reload fails the call; `later` defers it a tick for the one expected to reload.
const setVisibility = (page: Page, state: "hidden" | "visible", later = false) =>
  page.evaluate(([s, deferred]) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => s });
    const fire = () => document.dispatchEvent(new Event("visibilitychange"));
    if (deferred) setTimeout(fire, 0);
    else fire();
  }, [state, later] as const);

test.describe("a new version", () => {
  test("waits instead of reloading the page in use, and offers a Reload", async ({ page }) => {
    await controlledPage(page);
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event("controllerchange")));

    await expect(page.getByText("A new version is ready")).toBeVisible();
    expect(await marker(page)).toBe(1);

    await page.getByRole("button", { name: "Reload" }).click();
    await expect.poll(() => marker(page)).toBeUndefined();
  });

  test("reloads when the person comes back after a minute away, not after a quick switch", async ({ page }) => {
    await page.clock.install();
    await controlledPage(page);
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event("controllerchange")));

    await setVisibility(page, "hidden");
    await page.clock.fastForward("00:20");
    await setVisibility(page, "visible");
    expect(await marker(page)).toBe(1);

    await setVisibility(page, "hidden");
    await page.clock.fastForward("01:05");
    await setVisibility(page, "visible", true);
    await expect.poll(() => marker(page)).toBeUndefined();
  });
});
