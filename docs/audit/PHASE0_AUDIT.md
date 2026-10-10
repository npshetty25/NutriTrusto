# Phase 0 — Audit

Audited 2026-10-10 against `master` @ `07682b1`. No application code was changed.
Everything below was observed by reading the repo or running a command; anything I
could not verify is marked **Not verified**.

## 1. Corrections to the brief

The mega prompt describes the project as it was some months ago. These points differ
from what is in the repo today:

| Prompt says / implies | Actual |
|---|---|
| No automated tests | **223 Vitest unit tests in 7 files, all passing.** All are in `src/lib` (pure logic). No component tests, no API-route tests, no E2E. |
| Lint is something to keep green | **`npm run lint` already fails: 27 errors, 7 warnings** on untouched `master`. A CI lint step would be red on day one. |
| "Shared shopping lists" | The shopping list is **per-user**. `db/supabase-schema-additions.sql` §3 says "per-user; not shared via household in this version". Only `pantry_items` is household-shared. |
| Needs a PWA | A manifest (`src/app/manifest.ts`) and a service worker (`public/sw.js`, cache named per build) **already exist**. Gaps are narrower than "make it installable" — see §4. |
| OCR upload should use the phone camera | The **receipt** flow already has `capture="environment"` (`page.tsx:2254`). The **expiry-date** and **nutrition-label** scanners do **not**: their "Camera" button is an `accept="image/*"` input with no `capture`, identical to their "Gallery" button. |
| Needs a Dockerfile | Correct, none exists. **Docker is not installed on this machine** (`docker: command not found`), so Phase 3's "`docker compose up` locally" cannot be verified here. See §6. |
| Lighthouse PWA check | Not run in Phase 0. I believe the dedicated PWA category was removed from Lighthouse in v12; I will confirm by running it in Phase 1 rather than assert it now. |

## 2. Feature status

| Feature | Status | Evidence |
|---|---|---|
| Next.js + React front end | **Exists** | Next.js 16.2.1, **App Router** (`src/app`), React 19.2.4, TypeScript strict, Tailwind v4. `package.json` |
| Hosted on Vercel | **Exists** | `GET https://nutri-trusto.vercel.app/` → HTTP 200 (1.29 s) on 2026-10-10 |
| Package manager / Node | **Exists** | npm (`package-lock.json`), Node v22.18.0 locally, npm 10.9.3 |
| Supabase Postgres | **Exists** | 6 tables: `pantry_items`, `households`, `household_members`, `shopping_list_items`, `scan_history`, `item_outcomes` |
| RLS on every table | **Exists (in migration SQL)** | `enable row level security` on all 6, `db/*.sql` |
| Security-definer functions | **Exists (in migration SQL)** | `my_household_ids()`, `create_household()`, `join_household_by_code()`, `household_impact_leaderboard()`, trigger fn `delete_household_if_empty()`; all `set search_path = public` |
| 42P17 fix | **Exists in source** | `my_household_ids()` is `security definer`; the `households`, `household_members` and `pantry_items` policies all call it instead of subquerying `household_members` (`supabase-schema-additions.sql` lines 38–170). **Not verified against the live database** — I have no credentials for it and did not query production. |
| Gemini OCR | **Exists** | `gemini-2.5-flash` in `/api/extract` (receipts), `/api/scan-nutrition-label`, `/api/scan-expiry-date`; also `find-recipe`, `pantry-chat` |
| Household sharing | **Exists** | `create_household`, `join_household_by_code`, `household-modal.tsx` |
| Scan history | **Exists** | `scan_history` table (`product_name`, `source`, `health_score`, `scanned_at`) |
| Auth-gated API routes + rate limit | **Exists** | `src/lib/api-auth.ts` verifies the Supabase bearer token; `src/lib/rate-limit.ts` is per-instance in-memory (its own header says it is not distributed) |
| Mobile responsiveness | **Partial** | §3 |
| PWA | **Partial** | §4 |
| Unit tests | **Partial** | 223 tests, `src/lib` only. No coverage tool installed (`@vitest/coverage-v8` absent), so **no coverage % exists yet** |
| Component / API / E2E tests | **Missing** | no React Testing Library, no Playwright in `package.json` |
| CI | **Missing** | no `.github/` directory |
| Dockerfile / compose | **Missing** | none; Docker not installed locally |
| Structured logging | **Partial** | `src/lib/server-logger.ts` emits `[ts] [LEVEL] [route] [id] msg (+Nms) {json-meta}`. Request-scoped and useful, but a bracketed text line, not a JSON object per line |
| Health endpoint | **Missing** | `GET /api/health` → 404 locally and on the live site |
| Error tracking / monitoring | **Missing** | no Sentry or equivalent |
| MongoDB | **Missing** | no driver, no config |
| Trained ML model | **Missing** | categorisation today is keyword/rule based (`item-category.ts`, `shelf-life-data.ts`) |
| Java / Spring Boot | **Missing** | |
| Azure | **Missing** | |
| README | **Partial** | pitch, live link, setup, env table, stack, layout. Missing: architecture diagram, demo GIF, test/CI badges, RLS/DB explanation, links to reports |

## 3. Mobile responsiveness

Method: `docs/audit/responsive-audit.mjs` (Playwright 1.49.1, Chromium 131) against a
local production build (`npm run build && next start`). Authenticated pages were
rendered with a **mocked Supabase session and mocked REST responses**, so no request
reached the real project and no test account was created. The 8 pantry rows are
synthetic. Raw numbers: `metrics-before.json`.

Screenshots (full page): `{login,privacy,dashboard,recipes}-{375x812,768x1024}-before.png`.

| Page | Viewport | Horizontal scroll | Interactive elements | Under 44×44 px |
|---|---|---|---|---|
| /login | 375×812 | none (375/375) | 6 | 1 |
| /privacy | 375×812 | none | 2 | 2 |
| / (dashboard) | 375×812 | none | 30 | 1 |
| /recipes | 375×812 | none | 42 | 3 |
| /login | 768×1024 | none | 6 | 1 |
| /privacy | 768×1024 | none | 2 | 2 |
| / (dashboard) | 768×1024 | none | 30 | 1 |
| /recipes | 768×1024 | none | 42 | 3 |

The under-44px elements (identical at both widths):

| Element | Size |
|---|---|
| Show-password toggle (/login) | 24×24 |
| "Back to Nutri-Trust" link (/privacy) | 125×16 |
| Contact e-mail link (/privacy) | 267×20 |
| Profile dropdown button (dashboard, recipes) | 111×38 |
| "Back to pantry" button (/recipes) | 28×28 |
| Country search input (/recipes) | 343×42 |

What this says, plainly:

- **The app is already mobile-first and does not break at 375px.** There is no
  horizontal overflow on any page I measured. The prompt's premise that Phase 1 is a
  rescue job does not hold; it is polish.
- **Tablet is not designed for.** Only the `sm:` breakpoint is used (17 class
  strings); there is no `md`/`lg`/`xl`. `layout.tsx` wraps everything in
  `max-w-md mx-auto` (12 uses of `max-w-md` in `src`), so at 768px the app is a
  448px column. The page background gradient is clipped to that column and shows as a
  visible band (see `login-768x1024-before.png`). Not broken, but not adaptive either.
- Viewport meta is present: `width=device-width, initial-scale=1` (injected by Next).
- The only console errors were the Supabase realtime WebSocket failing to connect —
  an artefact of mocking the network, not an app defect.

**Limits of this audit.** Only the closed state of each page was measured. Modals
(household, shopping list, scanners, chat, impact dashboard, notifications
dropdown) and the scan-result dialog were not opened, so their overflow and tap
targets are **not verified**. The fixed bottom nav appears mid-page in the
full-page screenshots; that is a capture artefact of fixed positioning, not a bug.
I did not test on a physical phone.

## 4. PWA state

Live manifest (`/manifest.webmanifest`, HTTP 200) has `name`, `short_name`,
`start_url`, `display: standalone`, colours — and **one icon**: `/logo.svg`,
`sizes: any`. Gaps I can see from source (not yet confirmed with an installability
run):

- No 192×192 / 512×512 PNG icons and no `maskable` icon.
- No `apple-touch-icon` (iOS home-screen icon).
- Offline behaviour is "serve the cached `/` shell for any failed navigation"
  (`public/sw.js`). There is no dedicated offline page, and a cached shell that
  cannot load pantry data will not say why.
- Service worker is registered in production builds only (`layout.tsx`), which is
  deliberate and documented there.

## 5. Database

- Source of truth is four hand-run SQL files in `db/`; there is no migration tool and
  nothing records which have been applied to production.
- Indexes and length constraints arrive in `supabase-schema-hardening.sql`; the
  constraints are `NOT VALID` and the file ends with instructions to validate them
  manually. **Whether that was done on production is not verifiable from the repo.**
- `household_impact_leaderboard()` is `security definer`, so it bypasses RLS; it
  scopes itself to the caller's own household via `auth.uid()` and returns aggregates
  only. That is the pattern the Phase 8 warning is about, done correctly here.
- `scan_history` stores only `product_name`, `source`, `health_score`. It has **no
  scan ID** and does not keep the Gemini payload. Phase 4 therefore needs a new
  identifier to link a MongoDB document to a Postgres row; that is a schema change
  and falls under the "show the SQL, wait" gate.

## 6. Problems found, in plain English

Ordered by how much they affect the plan.

1. **Lint is red on `master`** (27 errors / 7 warnings: 11 `no-explicit-any`,
   11 `react/no-unescaped-entities`, 3 `react-hooks/set-state-in-effect`, 1
   `ban-ts-comment`, 1 `react-hooks/purity`; warnings are `no-img-element` ×4,
   `no-unused-vars` ×2, `no-page-custom-font` ×1). Phase 2 must clear these before a
   lint gate can mean anything. Raw list: reproducible with `npx eslint`.
2. **Docker is not installed here.** Phase 3's local DoD cannot be met on this
   machine. The honest alternatives are: you install Docker Desktop, or I verify the
   build and `compose up` + health check inside GitHub Actions and cite the CI log.
   I will not describe a container I never ran as working.
3. **No Maven/Gradle on PATH** (Java 23 is installed). Phase 8 would need one; the
   Maven wrapper can supply it without a system install.
4. **`src/app/page.tsx` is 2,847 lines.** Not a bug, but it is where every
   component-level test will have to reach, and it makes the E2E suite more valuable
   than unit tests for the dashboard.
5. **Coverage is unmeasured**, so no coverage number may appear on the resume until
   Phase 2 produces one from a real report.
6. **API routes call a paid model and require a signed-in user.** Any load test
   (Phase 5) must either use a mocked Gemini or stay off those routes; hammering
   them would spend real quota. `/api/health` is the safe target.
7. **Rate limiter is per-instance memory** — already documented in its own header;
   noted here because a load test will exercise exactly that limitation.
8. **Schema-applied state is unknowable from the repo** (see §5).

## 7. Baseline, before any change

| Check | Command | Result |
|---|---|---|
| Type-check | `npx tsc --noEmit` | exit 0 |
| Unit tests | `npm test` | 7 files, **223 passed**, 3.3 s |
| Build | `npm run build` | exit 0, 31.4 s, 19 static pages generated |
| Lint | `npm run lint` | **exit 1 — 27 errors, 7 warnings** |

Environment: Windows 11, Node 22.18.0, npm 10.9.3, Playwright Chromium 131.0.6778.33.
