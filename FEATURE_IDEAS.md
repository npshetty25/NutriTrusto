# NutriTrust — Feature Ideas & Fixes

Curated list for making the app more impressive to judges and genuinely
differentiated from other pantry-tracking apps. Ordered by priority within
each section. Each entry notes what already exists in the codebase that
makes it easier to build, so this doubles as an implementation starting
point, not just a wishlist.

**Status: 10 of 13 items below are built** (#1–9, #11). #10, #12, #13 are
still just ideas. One remaining step before the built ones are fully live:
run the latest `supabase-schema-additions.sql` in the Supabase SQL Editor
(adds `item_outcomes` + the household leaderboard function — confirmed via
a live query that this hasn't been applied yet). Everything that doesn't
depend on that migration has been verified end-to-end, including via live
Playwright runs against real seeded data.

---

## Fix first — a false safety claim currently in production

### 1. "Allergen Safe" badge is completely fake — ✅ fixed
**Where:** `src/components/pantry-card.tsx` line 32 (`allergensSafe = true` default)
and every call site in `src/app/page.tsx` that renders `<PantryCard {...item} .../>`
— none of them ever pass a real `allergensSafe` value, so it's `true` for
*every item, always*, regardless of what's actually in it.

**Why this matters more than a cosmetic bug:** it's not an unhelpful
suggestion (like the old "Better Alternative" text was) — it's an
unconditional, fabricated *safety* claim. Anyone with a real allergy who
trusts this badge is trusting nothing.

**How to actually fix it (and turn it into a real feature — see #2 below):**
you already fetch `ingredients_text` from Open Food Facts during barcode
scans (`handleBarcodeScan` in `page.tsx`) — it's just discarded after the AI
analysis call. Persist it (new `ingredients` text column on `pantry_items`,
or a lightweight `allergens` text array computed once at scan time), then
compute the badge from real allergen keyword matches instead of a default.

### 2. Real allergen detection (the feature version of the fix above) — ✅ built
Let each user flag specific allergens on their profile (nuts, gluten,
dairy, soy, shellfish, etc. — same UI pattern as the existing dietary
preference picker on signup). When a barcode is scanned, cross-reference
`ingredients_text` (already fetched from Open Food Facts) against the
user's flagged allergens and show a real warning — reusing the same
`dietConflictPrompt` modal pattern already built for diet conflicts.
Almost no competing pantry app does real allergen cross-referencing; this
is a genuine safety differentiator, not just a nice-to-have.

---

## Highest-impact new features

### 3. AI chat over your pantry — ✅ built
A real conversational box — "What can I cook tonight with what's
expiring?", "What's expiring this week?", "Is there anything with dairy
in it?" — answered by Gemini with your live pantry data (and, once #2
exists, allergen data) injected as context. You already have the Gemini
integration (`@google/generative-ai`, used in `/api/extract`,
`/api/scan-nutrition-label`, `/api/scan-expiry-date`) — this is a new API
route (`/api/pantry-chat`) that feeds it a JSON dump of the current
`pantry_items` rows plus the user's question, nothing else new to wire up.
**Why it matters:** this is the single most demoable thing you could add —
live in front of judges, typing a real question and getting a real,
current answer beats any slide describing "AI-powered."

### 4. Impact dashboard (waste saved / money saved / CO2 avoided) — ✅ built, ⏳ blocked on migration
Built as `ImpactDashboardModal`, reachable from the profile menu. Waste
rate / items-saved / $-saved / CO2-avoided all read from a new
`item_outcomes` table (logged automatically whenever an item is deleted),
and the nutrition-trend chart reads existing `scan_history.health_score`.
The `item_outcomes` table isn't live yet — the modal correctly shows a
"migration hasn't been run" message rather than crashing (verified live;
this exposed and fixed a real bug where that message never fired because
of a brittle error-string match — now matches on the actual Postgres
error code too).
A screen or card computing: items used before expiry vs. items that
expired unused (you already track this — an item deleted while
`daysLeft <= 0` vs. `> 0` tells you which), a rough money-saved estimate
(assign an average per-category price, sum across saved items), and a CO2
estimate (average food-carbon-footprint tables are public and simple to
hardcode per category via `inferItemCategory`, which already exists in
`src/lib/item-category.ts`). Feed it with a `dataviz`-style chart (line
chart over time, or a few stat tiles). Judges respond strongly to
quantified sustainability impact — this turns "we reduce food waste" from
a claim into a number.

### 5. Predictive restock suggestions — ✅ built, verified live
"You usually buy milk every 6 days — it's been 5" — computed from
`scan_history` (already logs every scan with a timestamp) plus deletions
over time. Even a simple version — average days between repeat purchases
of the same `product_name`, flagged when you're close to that average
again — is something almost no competing pantry-tracker does; most are
purely reactive (track what's currently there). This is the one addition
that would make NutriTrust categorically different, not just nicer.

### 6. Multi-item recipe generation from your actual pantry — ✅ built, verified live
Right now `generateRecipe()` in `page.tsx` picks *one* near-expiry item and
searches TheMealDB by that single ingredient, returning a public recipe
link. A more personalized version: send Gemini the full list of
near-expiry item names and ask it to generate an actual original recipe
(with steps) that uses as many of them as possible — not just a search
query against someone else's recipe database. More impressive, more
personalized, and it's reusing the Gemini integration you already have
rather than adding a new one.

---

## Worth doing if time allows

### 7. Household waste-reduction streak / leaderboard — ✅ built, ⏳ blocked on migration
Two layers: a personal streak ("N days since your last wasted item")
inside the Impact Dashboard, clearly labeled as per-account, not shared —
and a real household leaderboard section (shown only when you're in a
household) ranking every member by items-saved/waste-rate/streak. The
leaderboard is a `SECURITY DEFINER` SQL function
(`household_impact_leaderboard()`) that returns only aggregate counts and
display names to other members — never another member's raw item history —
so it doesn't weaken the per-user RLS policy on `item_outcomes`. Blocked
on the same pending `item_outcomes` migration as #4.

### 8. PWA installability (Add to Home Screen, works offline) — ✅ built
Makes the app feel like a shipped product instead of a web page — Next.js
has first-party support for a web manifest + service worker. Offline
support could start small: cache the last-fetched pantry list so it's
viewable with no connection, sync when back online.

### 9. Feed unknown-barcode corrections back to Open Food Facts — ✅ built, ⏳ needs real OFF credentials
Contribution is opt-in (checkbox in the manual-barcode-entry flow) and
posts to `/api/contribute-product`, which requires real `OFF_USER_ID` /
`OFF_PASSWORD` env vars — it returns a clear "not configured" error
rather than silently no-opping if they're missing, and there are none set
yet (production OFF writes are not anonymous; no account has been
created, and the documented staging test credentials no longer
authenticate). Field names/endpoint contract confirmed correct against
staging (got as far as a real auth rejection, not a 404).
When a barcode isn't found (`barcodeRetryPrompt` flow in `page.tsx`
already handles this case) and the user types the product name manually,
offer to submit that correction back to Open Food Facts via their
contribution API. Small, but shows real product thinking about the
open-data ecosystem the app already depends on.

### 10. Real push/email notifications — not built
Skipped for now — needs either Browser Push API (service-worker push
subscriptions + a push backend) or a scheduled server-side job (Supabase
Edge Function + cron / external cron), which is meaningfully more
infrastructure than the rest of this list. Still a good next item.
Today, expiry reminders are in-app toasts only (`sonner`) — nothing
reaches you if the app isn't open. Browser Push API for "3 items expiring
tomorrow," or a scheduled daily digest email (Supabase Edge Function +
cron, or a simple external cron hitting an API route), makes the core
"don't waste food" value proposition work even when you're not looking at
the app — which is when it actually matters.

### 11. Nutrition trend tracking — ✅ built (part of the Impact Dashboard)
A simple chart of the health scores of what's been scanned/added over
time (`scan_history.health_score` already exists as a column) — "is this
household buying healthier over time?" Ties directly into the app's own
"AI-powered nutrition insights" framing with an actual longitudinal view
instead of only per-item scores.

### 12. Batch "fridge cam" scanning — not built
Instead of one barcode at a time, let Gemini vision identify multiple
visible packaged products from a single photo of a shelf/fridge. Higher
technical risk (multi-object recognition accuracy will be inconsistent),
but a genuinely striking live demo if it works even partially — this is
the highest-risk, highest-reward item on this list.

### 13. Multi-language support (Hindi / regional) — not built
The app is already India-focused in its prompts (FSSAI label formats,
Indian receipt date conventions, Indian grocery brands). Adding a Hindi
(or other regional language) UI toggle, and having the Gemini prompts
accept/return in that language, could matter a lot in front of judges at
an Indian institution specifically.

---

## Suggested build order

1. Fix #1 (false allergen claim) — this is a correctness/trust issue, not
   optional polish.
2. Build #2 (real allergen detection) right after — same area of the code,
   turns the fix into a feature.
3. #3 (AI chat) for the best demo-effort ratio.
4. #4 (impact dashboard) for the strongest judge narrative.
5. #5 (predictive restock) if time allows — it's the most genuinely novel
   one on this list.
6. Everything in "worth doing if time allows," in whatever order fits your
   remaining time before the deadline.
