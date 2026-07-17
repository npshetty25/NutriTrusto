---
name: run
description: Launch the Nutri-Trust (smart-pantry) Next.js app and drive the golden path (signup -> dashboard -> demo data -> notifications -> AI recipe) in a headless browser to prove it's actually working, not just that it typechecks.
---

# Running Nutri-Trust (smart-pantry)

Single Next.js 16 (Turbopack) app. No separate backend — API routes are
serverless functions in the same process. Supabase (Postgres + Auth) and
Gemini are both fully hosted, so there is nothing else to start locally.

## Dev server

```bash
cd smart-pantry
npm run dev            # Next.js on http://localhost:3000, Turbopack, ~1.5s cold start
```

Env vars come from `smart-pantry/.env.local` (already checked in for this
project: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`GEMINI_API_KEY`). Stop with `kill` on the backgrounded PID, or
`pkill -f "next dev"`, before relaunching to avoid `EADDRINUSE`.

Smoke-check it's actually serving before driving it further:

```bash
curl -sf http://localhost:3000/ >/dev/null && echo OK
```

## Auth — important gotcha

The Supabase project has **`mailer_autoconfirm: true`** (confirm via
`GET https://ileghmcyotmlahlmyszj.supabase.co/auth/v1/settings` with the
anon key as `apikey` header — look for `"mailer_autoconfirm"`). This means:

- The login page's UI *always* shows a "Check your inbox" screen after
  signup (`src/app/login/page.tsx` sets `emailSent = true` unconditionally
  on success) — but the account is actually usable immediately.
- In practice, signing up often lands you **straight on the dashboard**
  without ever seeing that screen, because Supabase returns a live session
  synchronously and the login page's own `useEffect` redirects on `user`
  before the "check inbox" state has a chance to render.
- When driving this with a script, race both outcomes — don't assume
  either path:

```js
await Promise.race([
  page.waitForSelector('text=Check your inbox'),
  page.waitForSelector('text=Pantry Freshness'), // dashboard reached
]);
```

If the "Check your inbox" branch fires, click "Back to Sign In" and sign
in with the same credentials — it will succeed immediately (no real email
needed).

No admin/service-role key is available in this repo (only the anon key)
— there's no way to pre-provision a confirmed user via the Admin API.
Just sign up a fresh throwaway email each run, e.g.
`nutritrust.test.<timestamp>@example.com` / any password meeting
Supabase's minimum length.

## Driving it — no chromium-cli in this environment

`chromium-cli` was not installed here. Fallback: install `playwright`
into a scratch dir and drive `chromium` directly (browsers were already
present under `~/AppData/Local/ms-playwright`, so no browser download was
needed — just `npm install playwright` in a throwaway folder).

## One representative path (golden path)

1. `nav` to `/` → redirects to `/login`.
2. Click "Sign Up" tab, fill Full Name, pick a dietary preference button
   (`Veg` / `Non-Veg` / `Eggtarian`), fill email + password, click
   "Create Account".
3. Race the two outcomes above; end up on the dashboard
   (`text=Pantry Freshness` visible).
4. Click **"Add Demo Data"** — this is the fastest way to populate the
   pantry without camera/barcode hardware. It inserts 10 mock rows
   straight into Supabase via the client SDK and a toast
   ("Demo data added") confirms it.
5. Open notifications (`[aria-label="Open notifications"]`), confirm the
   panel lists spoilage warnings matching the seeded items' risk levels.
6. If any item is high-risk, an "AI Optimization" card appears with a
   "Generate" button — click it to trigger a live call to
   `themealdb.com` and confirm a recipe card renders (`text=Cook this`).
7. `console --errors` / check `pageerror` listeners — should be empty.

## Testing the barcode-scan flow without a camera

`BarcodeScanner` (`src/components/barcode-scanner.tsx`) tries to open a
real camera via `html5-qrcode`, which fails/errors in a headless
container — but it also renders a manual-entry text input + "Use"
button ("Having trouble scanning? Enter barcode manually.") that calls
the same `onScan` callback directly. Use it:

```js
await page.click('button:has-text("Barcode")');
await page.waitForSelector('input[placeholder="e.g., 8901234567890"]');
await page.fill('input[placeholder="e.g., 8901234567890"]', '737628064502'); // known-good UPC on Open Food Facts
await page.click('button:has-text("Use")');
await page.waitForSelector('text=Expiry Date', { timeout: 20000 }); // scannedResult modal, real OFF lookup + real Gemini analysis
```

This drives the *real* Open Food Facts lookup and the *real*
`/api/analyze-food` call — no mocking needed. From here you can also
test the expiry-date scanner (see below): click `button:has-text("Scan
date")`, then `page.locator('input[aria-label="Upload expiry date
photo"]').setInputFiles(...)` with a test image.

To generate a synthetic test label image (no real product photo
needed — Gemini reads rendered HTML text on a screenshot just fine):
render an HTML string with `page.setContent()` in a throwaway page and
`page.screenshot()` it, e.g. a div with `MFD: 10/07/2026` / `EXP:
20/07/2026` text. Verified working scenarios:
- absolute `MFD`/`EXP` dates → `source: "printed_expiry"`
- shelf-life-only text like "Best Before 6 Months From Packaging" with
  no MFD → assumes packaging = today, `source: "shelf_life_from_today"`
- no date text at all → `confidence: "low"`, `days_left: null` (UI
  shows an error and falls back to the 30-day default)

## Gotchas that recur

- **React controlled inputs**: use Playwright `fill`, not `el.value = …`.
- **First `nav` can take 10s+** — Turbopack compiles the route on
  demand. `waitForSelector`, don't `sleep`.

### Fixed (no longer gotchas, but worth knowing why)

- Previously two elements shared `aria-label="Close notifications"`
  (the full-screen backdrop button and the real X button) — fixed by
  making the backdrop `aria-hidden`/non-focusable instead of labeled.
- Previously the Sonner toast stack used its default
  `z-index: 999999999`, above every modal in the app, so an "Expiry
  Reminder" toast could visually sit on top of the notifications panel
  or AI recommendation card and intercept clicks meant for them. Fixed
  by passing `style={{ zIndex: 45 }}` to `<Toaster>` in
  `src/app/layout.tsx`, sandwiching it between backdrop overlays
  (`z-40`) and modal content (`z-50`/`z-60`). If you add a new
  full-screen overlay, keep its content above `z-45` or it'll have the
  same problem.
