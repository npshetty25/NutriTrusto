import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests run against a production build (`next start`), with Supabase,
 * Open Food Facts and the Gemini-backed API routes replaced at the network
 * layer by e2e/support/fake-backend.ts. Nothing here reaches a real service.
 *
 * The build bakes in a throwaway Supabase URL so that every request the app
 * makes is to a host the fake owns; the real project is never named.
 *
 *   npx playwright test                 builds, starts the server, runs
 *   E2E_SKIP_BUILD=1 npx playwright test   reuse an existing .next build
 *                                          (CI builds in its own step)
 */
const PORT = 3100;
const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "https://e2e.supabase.test";

const serverEnv = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
  // Present so the routes' "not configured" branch is not what gets exercised.
  // Never used: the browser-side mock answers /api/* before it leaves the page.
  GEMINI_API_KEY: "e2e-not-a-real-key",
  // Matches e2e/fixtures.ts's adminBackend fixture (ADMIN_TEST_EMAIL).
  NEXT_PUBLIC_ADMIN_EMAILS: "admin@example.test",
};

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }], ["json", { outputFile: "test-results/e2e-report.json" }]]
    : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // page.route() cannot see requests a service worker handles. The worker is
    // covered on its own in the `pwa` project; everywhere else it is blocked so
    // the fake backend sees every call.
    serviceWorkers: "block",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /pwa\.spec\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /(pwa|layout)\.spec\.ts/ },
    { name: "pwa", use: { ...devices["Pixel 7"], serviceWorkers: "allow" }, testMatch: /pwa\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? `npm run start -- -p ${PORT}`
      : `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: serverEnv,
  },
});
