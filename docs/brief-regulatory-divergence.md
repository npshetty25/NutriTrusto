# Design Brief — Additive Regulatory Divergence

Status: **built and verified.** All six steps complete.

Supersedes the "globally banned ingredient alerts" concept described in
`PRODUCT.md → Committed, not yet built` and in the judge Q&A (Q13/Q14).

---

## Why the original concept changed

The premise — *globally banned ingredients are still sold in India* — did not
survive fact-checking. Of the three headline examples in the judge Q&A:

| Substance | Q&A claim | Verified |
| --- | --- | --- |
| Titanium dioxide (E171) | EU-banned, in Indian candy | **Correct.** EU withdrew authorisation 7 Aug 2022; India still permits it (GMP-level), as do the US, UK, Canada, Australia/NZ |
| Potassium bromate | "still permitted by FSSAI" | **Wrong.** India banned it 20 Jun 2016 following the CSE bread study |
| Brominated vegetable oil | "still found in Indian energy drinks" | **Wrong.** India banned it in 1990 — before the EU (2008), Japan (2010) and the US (2024) |

Both errors point the same direction: they understate Indian regulators. A
feature built on that premise would be thin (few substances qualify) and
embarrassing under scrutiny.

The honest version is more interesting: **regulatory authorities disagree with
each other, in both directions.** India is stricter than the US on some
substances and more permissive than the EU on others. Surfacing that
disagreement is genuinely novel, needs no safety claim, and cannot be
falsified — because every entry is a citation, not an opinion.

---

## 1. Job and audience

A shopper holding a packet, deciding whether to buy it — the same moment the
barcode scanner already serves. Mode: **Operate**. They are standing in a
shop, one-handed, with seconds of attention.

They are not toxicologists and must not be asked to become one. The job is
*"is there anything about this I should know before I buy it?"* — answered in
one glance, with a route to detail if they want it.

Secondary audience: an evaluator who will try to break the claim. The design
must make the sourcing visible rather than hide it behind a verdict.

## 2. Outcome and proof

**Primary action:** the user reads a regulatory note and either buys, or puts
it back and scans an alternative.

**Success:** the user learns a specific, checkable fact they did not know —
"the EU withdrew this colouring in 2022" — not a feeling that the product is
bad.

**Proof carried:** every finding shows the substance, its E-number, the
authority, the direction of the divergence, the date, and the instrument
(e.g. *Commission Regulation (EU) 2022/63*). The citation is part of the UI,
not a footnote.

**Product truth a competitor could not copy:** Yuka scores products against a
single implicit standard. This states *whose* standard, and where standards
conflict — which only matters, and only makes sense, for an India-first app.

## 3. Selected direction

Visual authority is the existing system (`DESIGN.md`, "The Honest
Instrument"). This feature is that metaphor's clearest expression yet: an
instrument reporting a reading with its calibration source attached.

**Structural thesis:** a finding is a *comparison*, not a verdict. Every
presentation shows two jurisdictions side by side. The user is never told the
food is unsafe; they are shown that two regulators disagree and who they are.

**Consequence:** this rules out a single-colour danger treatment. Divergence
is not risk, so it does not get Reading Danger. It needs a fourth semantic
role — see Open Decisions.

## 4. Scope and boundaries

**In scope**
- A curated, cited additive dataset (a source file in the repo, not a DB table)
- Detection by matching that dataset against `ingredients_text`, which is
  already fetched from Open Food Facts and already persisted
- Scan-result section, compact pantry-card chip, and an "Additive Reference"
  screen listing the whole dataset with citations

**Out of scope / anti-goals**
- **No health or safety claim.** Never "unsafe", "toxic", "carcinogenic", or
  "dangerous". The app reports what regulators did, with dates.
- **No FSSAI compliance verdict.** No public machine-readable FSSAI API
  exists; the app must never imply a live regulatory lookup.
- No change to the NutriTrust score. Divergence is reported alongside the
  score, never folded into it — mixing a nutrition score with a regulatory
  fact makes both unreadable.
- No change to allergen detection, dietary filtering, or the pantry loop.
- No expansion beyond additives (no pesticides, contaminants, or packaging).

**Untouched:** the scan flow's existing steps, the score, the recipe loop, and
every screen not named above.

## 5. States and ranges

Realistic ranges from the products already in `scan_history`:

- **Typical:** 0 divergent additives. **This is the default state and must
  feel like a clean result, not an absence of data.**
- **Common:** 1 finding (E171 in confectionery, sweets, chewing gum)
- **Upper:** 2–3 findings on heavily processed snacks
- **Dataset size:** 15–30 substances at launch. Small and correct beats large
  and unverified — every row needs a citation before it ships.

States to design:

| State | Behaviour |
| --- | --- |
| No ingredient data | "Ingredients not available for this product" — the same honesty posture as the existing "Allergens Unknown" chip. Never render as "clear". |
| Ingredients present, no findings | Positive, quiet confirmation: "No additives with divergent regulatory status." |
| 1+ findings | Listed most-divergent first, each with authority, direction, date, source. |
| Substance recognised, status uncertain | Omitted entirely. An unverifiable row must never ship. |
| Reference screen empty/offline | Dataset is bundled in the app, so it always renders — no network state needed. |

## 6. Interaction and layout

**Scan result.** A new section below the existing concerns/positives, at the
same level of prominence — not above the score. A finding renders as one row:
substance name with E-number, then a single plain sentence of the form
*"Permitted in India · Withdrawn in the EU (Aug 2022)"*, then the instrument
cited in Label type. Tapping expands to the full note and a link to the
source. Collapsed by default at more than two findings.

**Pantry card.** A compact chip in the existing measurement-chip row, beside
the diet and allergen chips, reading e.g. `E171 · EU-withdrawn`. It follows
the established chip anatomy exactly (10% wash, 20% border, Label type). No
new layout region.

**Additive Reference screen.** Reached from the profile menu, alongside Scan
History and Impact Dashboard, opening as a standard portalled dialog per the
system's dialog rules. A searchable list of every substance in the dataset:
name, E-number, per-authority status with dates, and the citation. This is
the artefact to show an evaluator who asks "where does your data come from" —
the answer is a screen, not a slide.

**Hierarchy:** score first, then nutrition concerns, then regulatory notes.
Divergence is context, not the headline; promoting it above the score would
overstate it.

**Feedback and transitions:** findings enter with the standard card spring;
the expand/collapse uses the established height transition. No new motion
vocabulary.

## 7. Constraints and open decisions

**Binding constraints**
- `ingredients_text` is only populated for barcode-scanned items with Open
  Food Facts coverage. Manually added and receipt-imported items will mostly
  have none — the "not available" state is the common case, not an edge case.
- Detection is keyword matching over free text, the same mechanism as
  `src/lib/allergens.ts`. It will miss substances written unusually. The copy
  must not imply exhaustive screening.
- The dataset is hand-maintained. It needs a `lastReviewed` date shown on the
  Reference screen, so staleness is visible rather than hidden.
- Pantry-card persistence needs a column and therefore a migration appended
  to `db/supabase-schema-additions.sql` — which is still unrun.

**Open decisions a builder must not invent**
1. **The fourth semantic colour.** `DESIGN.md`'s Readout Rule reserves
   green/amber/red for freshness and risk. Divergence is neither. It needs
   either a new neutral-informational role or a deliberate amendment to the
   rule. *Do not reuse Reading Danger.*
2. **Dataset sourcing.** Every row needs a verifiable citation. The three
   examples above are verified; the remaining 12–27 are not. Sourcing is the
   critical path and the slowest part of this work — not the UI.
3. **Direction labelling.** Whether to show both directions (India stricter
   *and* more permissive) or only where India is more permissive. Showing
   both is more honest and more interesting; showing one is simpler.

---

## Recommended build order

1. ✅ **Seeded** — `src/lib/additive-divergence.ts` carries 9 verified entries
   (E171; potassium bromate; BVO; and the six Southampton colours), each with
   a dated citation, plus `LAST_REVIEWED`. Grow it only as entries are
   actually checked against their instrument.
2. ✅ **Resolved: divergence carries no readout colour at all.** Recorded as
   *The Annotation Rule* in `DESIGN.md`. A citation is not a reading, and an
   amber chip would say *danger* about a fact meaning *two regulators
   disagree*. It renders in neutral ink with an outline icon, earning
   prominence from position and type instead.
3. ✅ Detection — `detectDivergentAdditives()`, mirroring the allergens
   module, returning `null` for "no ingredient data" and `[]` for "none
   found" so the two can never be collapsed
4. ✅ Scan-result section
5. ✅ Additive Reference screen
6. ✅ Pantry-card chip — **no migration needed after all**: `ingredients_text`
   is already persisted, so divergence is derived client-side exactly as
   allergens are

Verified per-card in light and dark at phone and desktop widths: a 3-match
item, a 1-match item, an item with ingredients but no match, and an item with
no ingredient data at all each render correctly, with no page errors.
