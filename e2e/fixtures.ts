import { test as base, expect, type Page } from "@playwright/test";
import { FakeBackend, TEST_USER } from "./support/fake-backend";

/** Must match playwright.config.ts's NEXT_PUBLIC_ADMIN_EMAILS for this to be admin. */
export const ADMIN_TEST_EMAIL = "admin@example.test";

type Fixtures = {
  /** A fake backend installed on a signed-out context. */
  anonymous: FakeBackend;
  /** A fake backend installed with a session already in storage. */
  backend: FakeBackend;
  /** Same, but signed in as the email NEXT_PUBLIC_ADMIN_EMAILS was built with. */
  adminBackend: FakeBackend;
};

export const test = base.extend<Fixtures>({
  anonymous: async ({ context, page }, provide) => {
    const backend = new FakeBackend();
    await backend.install(context);
    await backend.quietRealtime(page);
    await provide(backend);
  },
  backend: async ({ context, page }, provide) => {
    const backend = new FakeBackend();
    await backend.install(context, { signedIn: true });
    await backend.quietRealtime(page);
    await provide(backend);
  },
  adminBackend: async ({ context, page }, provide) => {
    const backend = new FakeBackend();
    // Must be set before install(): install() bakes the session into an
    // addInitScript closure, evaluated once, at that call.
    backend.user = { ...TEST_USER, email: ADMIN_TEST_EMAIL };
    await backend.install(context, { signedIn: true });
    await backend.quietRealtime(page);
    await provide(backend);
  },
});

export { expect };

/** Open the dashboard and wait until the pantry has finished loading. */
export async function openDashboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Barcode/ }).first()).toBeVisible();
}

/** A real JPEG header, which is all upload validation (and the mock) needs. */
export const jpeg = (name = "receipt.jpg") => ({
  name,
  mimeType: "image/jpeg",
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0]),
});

/**
 * Interactive elements that are actually on top at their own centre and are
 * smaller than 44px in either dimension. The same measure the Phase 1 audit
 * used, so this suite is the regression guard for that work.
 */
export async function undersizedTargets(page: Page) {
  return page.evaluate(() => {
    const small: Array<{ tag: string; w: number; h: number; label: string }> = [];
    const sel = 'a[href], button, input:not([type=hidden]):not([type=file]), select, textarea, [role=button]';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
      const cy = r.top + r.height / 2;
      if (cy < 0 || cy > innerHeight) continue;
      const hit = document.elementFromPoint(cx, cy);
      if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) continue;
      if (r.width < 43.5 || r.height < 43.5) {
        small.push({
          tag: el.tagName.toLowerCase(),
          w: Math.round(r.width),
          h: Math.round(r.height),
          label: (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
        });
      }
    }
    return small;
  });
}

export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/**
 * Open the profile menu. A click that lands before hydration is silently
 * dropped, so retry the click until the menu is really there; this is a
 * property of server-rendered pages, not something to paper over with sleeps.
 */
export async function openProfileMenu(page: Page) {
  await expect(async () => {
    await page.locator('button[aria-haspopup="menu"]').click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}
