# Phase 1 — Mobile-responsive and installable PWA: results

Branch `feat/p1-mobile-pwa`. Every number below is read from a file in this
directory; the scripts that produced them are `responsive-audit.mjs` and
`verify-phase1.mjs`.

## Definition of Done

| DoD item | Result | Evidence |
|---|---|---|
| Before/after screenshots at 375px and 768px | **Met** | `*-375x812-{before,after}.png`, `*-768x1024-{before,after}.png` for login, privacy, dashboard, recipes |
| Lighthouse PWA / installability check passes | **Met in substance, not literally.** Lighthouse no longer has a PWA category, so that exact check cannot be run. Chrome's own installability check returns no errors. | `lighthouse-login-summary.json` (the `pwa` category is rejected by Lighthouse 13.5.0), `pwa-check-after.json` (`installabilityErrors: []`, `manifestErrors: []`) |
| Camera capture works in mobile emulation | **Met for the attribute and the chooser; not met for a real camera.** Pixel 7 emulation, real clicks, real file-chooser events. | `dialogs-check-after.json` |

## What was measured

### Tap targets under 44px

| View set | Views | Before | After |
|---|---|---|---|
| Closed pages (login, privacy, dashboard, recipes × 375 and 768) | 8 | 14 | **0** |
| Dialogs: barcode scanner, scan result, expiry scanner, label scanner | 4 (+2 control views) | 8 | **0** |
| Overlays: profile menu, notifications, chat, edit item, household, shopping list, scan history, impact | 8 | 26 | **0** |

Notes on how to read that:

- **Dialog and overlay "before" values were taken after the closed-page fixes had
  already landed**, not at the original baseline. The closed-page baseline is
  `metrics-before.json`. The dialogs were not in the Phase 0 audit at all; I
  added them once the closed pages came back mostly clean and I suspected the
  audit was too shallow. It was.
- "Under 44px" counts an element only if it is the top element at its own centre
  point, so controls hidden under a modal backdrop are not counted. Sub-pixel
  layout is tolerated down to 43.5px.
- The same underlying control can be counted in several views (the profile pill is
  on the dashboard and the recipes page). The totals are element-instances per
  view, not unique components.

### Text inputs under 16px (iOS Safari zooms the page on focus)

7 distinct fields measured under 16px (12px barcode entry; 14px pantry search,
chat, invite code, add-item, and the edit dialog's name and days fields). After:
**0**. This is based on the computed font size and on the documented iOS
behaviour; **I did not test on an iOS device**, so the absence of zoom is
inferred, not observed.

### Horizontal overflow

None on any measured view, before or after, at 375px or 768px.

### Camera capture (Pixel 7 emulation, `Page.waitForEvent("filechooser")`)

| Control | `capture` attribute |
|---|---|
| Receipt › Take Photo | `environment` |
| Receipt › Choose from Gallery (control) | none |
| Expiry scanner › Camera | `environment` |
| Expiry scanner › Gallery (control) | none |
| Nutrition-label scanner › Camera | `environment` |
| Nutrition-label scanner › Gallery (control) | none |

Before this phase the expiry and label scanners' Camera buttons had no `capture`
attribute and behaved identically to Gallery. Only the receipt flow was correct.

### PWA

| Check | Result |
|---|---|
| Chrome installability errors | none |
| Manifest errors | none |
| Icons declared | 192, 512, maskable 512 (PNG, dimensions verified by decoding), plus the SVG |
| `apple-touch-icon`, `apple-mobile-web-app-capable` in `<head>` | present |
| Service worker active and controlling the page after one reload | yes |
| Offline page precached by the worker | yes (`nutri-trust-shell-<commit>`) |
| Offline behaviour, **server process confirmed stopped** | `/login`, `/recipes`, `/privacy` each return the offline page from the service worker |

### Lighthouse 13.5.0 — `/login`, signed out

Performance 90, Accessibility 100, Best Practices 100, SEO 100. FCP 1.9 s, LCP
3.0 s, TBT 80 ms, CLS 0.

**These are not claims about the app.** One run, one page (the signed-out
login screen), a local production build on a laptop, Lighthouse's simulated
mobile throttling. The authenticated dashboard was not run through Lighthouse.

## What changed

- **Tap targets and inputs:** 27 small commits, one per component or control
  (31 `fix` commits on the branch in total, 7 `feat`, 3 `docs`).
- **Camera:** `capture="environment"` on the expiry and label scanners.
- **Tablet layout:** the root column widens from `max-w-md` to `md:max-w-3xl`;
  the pantry list is two columns from `md`; the login backdrop is a fixed layer
  instead of being clipped to the phone column.
- **Pantry card:** the item name has its own row. It was being cut to
  "Whole …" on phones because the risk badge took most of the line.
- **PWA:** PNG, maskable and apple-touch icons (`scripts/generate-icons.mjs`),
  a complete manifest, an offline page, and a service worker whose navigations
  are network-only with the offline page as the fallback.

### A behaviour change worth knowing about

The previous service worker served the last cached copy of a page when the
network failed. That copy would run, find no network, and render "Your pantry is
empty" — a false statement about the user's data — and could replay a stale build.
Navigations are now network-only and fall back to the offline page. The cost is
that no page renders offline at all, which was never useful because every page
needs Supabase. Hashed build assets are still cached.

## What was not tested

- **No physical device, no iOS, no Safari.** Everything is Chromium emulation.
- **A real camera.** Emulation proves the attribute and the chooser, not capture.
- **Dark mode** was not screenshotted.
- Dialogs not reached: recipe modal, manual-barcode-name dialog, barcode-retry
  dialog, delete confirmation, filter panel. The recipe modal's close button was
  fixed on the strength of identical markup, not measured.
- The two-column tablet layout was checked in the closed state with 8 mock items;
  it was not checked with long names, many items or the expanded storage panel.
- Authenticated views use a **mocked Supabase session and synthetic items**; no
  real account or production data was involved.

## Left alone on purpose

`src/components/site-footer.tsx` (privacy-policy and contact links) is not
rendered anywhere — an earlier commit removed it deliberately. `/privacy` is
therefore reachable only by URL and the sitemap. That is a product decision,
so I did not reinstate it.
