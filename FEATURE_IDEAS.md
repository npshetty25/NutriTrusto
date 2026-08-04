# NutriTrust — Feature Ideas & Fixes

Curated list for making the app more impressive to judges and genuinely
differentiated from other pantry-tracking apps. Ordered by priority within
each section. Each entry notes what already exists in the codebase that
makes it easier to build, so this doubles as an implementation starting
point, not just a wishlist.

---

## Fix first — a false safety claim currently in production

### 1. "Allergen Safe" badge is completely fake
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

### 2. Real allergen detection (the feature version of the fix above)
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

### 3. AI chat over your pantry
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

### 4. Impact dashboard (waste saved / money saved / CO2 avoided)
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

### 5. Predictive restock suggestions
"You usually buy milk every 6 days — it's been 5" — computed from
`scan_history` (already logs every scan with a timestamp) plus deletions
over time. Even a simple version — average days between repeat purchases
of the same `product_name`, flagged when you're close to that average
again — is something almost no competing pantry-tracker does; most are
purely reactive (track what's currently there). This is the one addition
that would make NutriTrust categorically different, not just nicer.

### 6. Multi-item recipe generation from your actual pantry
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

### 7. Household waste-reduction streak / leaderboard
Light gamification on top of the household-sharing feature already built
(`households`/`household_members`). Track a per-household "days without a
wasted item" streak, or rank members by items-saved. Cheap to build (a
computed value over existing `pantry_items` rows), and gives the sharing
feature a reason to be used repeatedly rather than just as a demo.

### 8. PWA installability (Add to Home Screen, works offline)
Makes the app feel like a shipped product instead of a web page — Next.js
has first-party support for a web manifest + service worker. Offline
support could start small: cache the last-fetched pantry list so it's
viewable with no connection, sync when back online.

### 9. Feed unknown-barcode corrections back to Open Food Facts
When a barcode isn't found (`barcodeRetryPrompt` flow in `page.tsx`
already handles this case) and the user types the product name manually,
offer to submit that correction back to Open Food Facts via their
contribution API. Small, but shows real product thinking about the
open-data ecosystem the app already depends on.

### 10. Real push/email notifications
Today, expiry reminders are in-app toasts only (`sonner`) — nothing
reaches you if the app isn't open. Browser Push API for "3 items expiring
tomorrow," or a scheduled daily digest email (Supabase Edge Function +
cron, or a simple external cron hitting an API route), makes the core
"don't waste food" value proposition work even when you're not looking at
the app — which is when it actually matters.

### 11. Nutrition trend tracking
A simple chart of the health scores of what's been scanned/added over
time (`scan_history.health_score` already exists as a column) — "is this
household buying healthier over time?" Ties directly into the app's own
"AI-powered nutrition insights" framing with an actual longitudinal view
instead of only per-item scores.

### 12. Batch "fridge cam" scanning
Instead of one barcode at a time, let Gemini vision identify multiple
visible packaged products from a single photo of a shelf/fridge. Higher
technical risk (multi-object recognition accuracy will be inconsistent),
but a genuinely striking live demo if it works even partially — this is
the highest-risk, highest-reward item on this list.

### 13. Multi-language support (Hindi / regional)
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
