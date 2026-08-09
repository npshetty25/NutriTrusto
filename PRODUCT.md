# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Urban Indian households, Tier 1/2 cities, roughly ages 18–60. Treated as one
universal household tool rather than a single lead segment, so every surface
has to hold up for both ends of the range:

- **Students and young urban professionals** — small shelves, few items, fast
  scan-and-go, low setup tolerance, mobile-first and often one-handed.
- **Homemakers and household food managers** — the segment with the highest
  pantry pain: larger inventories, shared households, daily rhythms.

Survey base (Phase 1, n=79): 63% students, 19% self-employed, 10% working
professionals, 5% homemakers. The skew toward students is a known sampling
limitation, not a statement of who the product is for.

**The job:** decide whether a packaged product is worth buying while standing
in the shop, and keep track of what is already at home so it gets eaten
before it spoils.

## Product Purpose

Nutri-Trust decodes packaged-food labels at the point of purchase and tracks
what is in the pantry so it gets used before it expires.

Success means a user makes a purchase decision they would not otherwise have
made, and throws away less of what they buy.

Problem definition from Phase 1 primary research (n=79):

- 94% have no pantry tracking system of any kind
- 84% experience some degree of ingredient-label confusion (52% markedly, at
  Likert 4–5; the fuller 84% figure includes "moderately")
- 73% waste food regularly
- 39% have knowingly consumed expired food
- 42% are unaware that globally banned ingredients appear in Indian food
- 71% stated intent to use

## Positioning

**The closed loop is the product:** scan barcode → item lands in the pantry →
expiry tracked → recipe surfaced as expiry approaches. Competitors credibly
do one half or the other, not the loop.

- **Yuka** (50M+ users) — scan-and-go only. No pantry, weak Indian product
  coverage, no Indian dietary context.
- **KitchenPal** — pantry and recipes, but Western, manual entry with no
  barcode capture, and no nutrition intelligence layer.

The defensible edge is India-specific: Indian product coverage,
veg/eggtarian/non-veg as first-class dietary logic, and regulatory
intelligence tuned to what is actually sold in India.

## Operating Context

- Academic: Manipal B.Tech UG minor project. Phase 1 (Empathise + Define) is
  complete. **The next milestone is both a Phase 2 report and a live
  judging-panel demo** — the app must read well in screenshots and survive
  live scrutiny on a projector.
- Team of three: Nirav, Sumit, Prisha. Delivery is divided by member, but
  every member is expected to answer on any section.
- Grounding theory: Health Belief Model, Technology Acceptance Model,
  Nudge Theory.
- Live prototype: https://nutri-trusto.vercel.app
- Judges probe hard. A 47-question adversarial Q&A bank exists at
  `project-files/reports/NutriTrusto_Judge_QA.html`. Note that parts of it
  have drifted from the code — see Capabilities below.

## Capabilities and Constraints

### Built and working

- Barcode scan → Open Food Facts (India first, then global fallback) →
  NutriTrust score with concerns and positives
- Nutrition-label scanner and expiry-date scanner (Gemini vision) as the
  fallback when a product is not in the database
- Receipt scanning → bulk pantry add, extracting the real purchase date
- Pantry with expiry countdown and risk levels
- Allergen detection from real ingredient text (7 tags), which reports
  "unknown" rather than "safe" when ingredient data is absent
- Dietary preference (veg / eggtarian / non-veg) enforced in recipe
  suggestions and surfaced as conflict warnings
- Recipe suggestions restricted to Indian cuisine on the dashboard; a
  separate `/recipes` surface browses 37 cuisines
- Household sharing, shopping list, scan history, notifications
- Impact dashboard: waste rate, ₹ saved, CO₂ avoided, streak, nutrition
  trend, household leaderboard (requires `db/supabase-schema-additions.sql`)
- Installable as a PWA; AI chat grounded in the live pantry
- Opt-in contribution of corrected barcodes back to Open Food Facts
  (inactive until `OFF_USER_ID` / `OFF_PASSWORD` are set)

### Committed, not yet built

These are described as working in the judge Q&A but do not exist in the code.
They are intended and confirmed as differentiators to build. **Until they
ship, no surface, document, or answer may present them as working.**

- Additive regulatory divergence — surfacing substances whose status differs
  between India and other major authorities, each with a dated citation.
  Shaped in `docs/brief-regulatory-divergence.md`; not yet built.

  This replaces the earlier "globally banned ingredient alerts" concept,
  whose premise did not survive checking: of the three examples given in the
  judge Q&A, only titanium dioxide (E171) holds. India banned potassium
  bromate in 2016 and brominated vegetable oil in 1990 — in the latter case
  ahead of the EU, Japan and the US. **The Q&A's Q13/Q14 answers are
  factually wrong and need correcting before any viva.**
- A live FSSAI compliance verdict is explicitly *not* a goal: no public
  machine-readable FSSAI API exists, so any such check would be a
  hand-maintained list and must be described as one
- Health-conditions profile — only allergens and diet type exist today
- The NutriTrust score's documented weighting (Nutri-Score 40% / additives
  30% / NOVA 20% / banned-ingredient penalty 10%). The shipped score derives
  from the Nutri-Score grade plus additive and nutrient checks, without NOVA
  or an FSSAI penalty

### Technical constraints

- Next.js 16 (App Router) on Vercel; Supabase Postgres, Auth, Realtime, with
  row-level security scoping every table to its owner
- Gemini `gemini-2.5-flash` (the judge Q&A's "Gemini 1.5 Flash" is stale)
- No public machine-readable FSSAI compliance API exists — any compliance
  check must be a hand-maintained rule-based list, and must be described that
  way rather than as a live regulatory lookup
- Swiggy and Blinkit expose no public API; import is upload/screenshot
  parsing only, never scraping
- Free tiers: Vercel hobby (no SLA), Supabase free (project auto-pauses)
- Health profile data is sensitive; it stays owner-scoped and unshared

### Terminology

"NutriTrust score", 1–5. The product name appears as both "Nutri-Trust" and
"NutriTrusto"; this is currently inconsistent and undecided.

## Brand Commitments

- Name: NutriTrusto / Nutri-Trust — *Nutri* from nutrition, *Trusto* from
  trust, positioning it as a trusted companion rather than a scanner
- Tagline: **"Smart Food Choices. Zero Waste."**
- India-first, not India-adapted
- Existing logo: `public/logo.svg`
- Honesty is a brand commitment, not just a policy. The name is trust; a
  fabricated safety claim costs more here than a missing feature. This is why
  the allergen badge degrades to "unknown" instead of "safe"

## Evidence on Hand

- 79-respondent survey (Phase 1) with the findings listed above
- 8 semi-structured empathy interviews — **notes only, not transcripts**
- Observational study of 10 consumers in grocery stores
- Empathy map, Ishikawa fishbone (6M), 5 Whys, affinity mapping, POV statement
- Competitive analysis across 5 competitors and 10 features
- Working prototype at nutri-trusto.vercel.app
- Decks, reports, and the judge Q&A bank in `../project-files/`

**Absences that must not be fabricated:** no Cronbach's Alpha yet, no
usability testing of the prototype, no formal customer journey map, no
interview transcripts, no real users, no revenue, and no nutritionist
validation of the NutriTrust score.

## Product Principles

1. **Never assert what cannot be substantiated.** Trust is the name. Unknown
   is an acceptable answer; a confident wrong answer is not.
2. **The loop is the product.** Scan → track → use up. Anything that does not
   serve that loop is secondary, however impressive.
3. **India-first, not India-adapted.** Indian dishes, Indian dietary
   categories, Indian regulatory context, Indian prices — as defaults.
4. **Own the limits.** Phase-appropriate honesty beats overclaiming, in the
   product exactly as in the viva.
5. **Works at both ends.** A five-item student shelf and a fifty-item family
   pantry must both feel designed for.

## Accessibility & Inclusion

- Dietary and religious eating practices (veg / eggtarian) are first-class
  product logic, not an optional filter
- Allergen information degrades to "unknown" rather than "safe" whenever
  ingredient data is missing
- Motion respects `prefers-reduced-motion`
- No formal WCAG conformance level has been established yet — open decision
