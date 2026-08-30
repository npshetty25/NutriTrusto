# Shelf-life estimation — assumptions and divergences

Every entry states the assumption, why it was chosen, and how it differs from
a published standard. Where we diverge, the divergence is deliberate and
recorded here so it can be defended rather than discovered.

**Nothing in this system is a safety guarantee.** The date printed on the
pack and the user's own senses remain authoritative. Every estimate is a
conservative reminder.

---

## 1. Storage temperatures: 7 °C fridge, 29 °C counter

**Assumption.** Refrigerated items are modelled at **7 °C**; counter and
pantry items at **29 °C**.

**Why.** Indian domestic refrigerators run warmer than the laboratory
assumption: they are opened frequently in ambient heat, are often packed
full, and lose the cold chain entirely during power cuts. Typical Indian
ambient is 25–35 °C.

**Divergence, stated plainly.**

| Source | Fridge assumption |
|---|---|
| USDA FoodKeeper / FDA | 4 °C (40 °F) |
| FSSAI cold-holding | ≤5 °C |
| **Nutri-Trust** | **7 °C** |

We are **warmer than both**. This is a realism choice, not an oversight, and
not a claim that 7 °C is compliant — FSSAI's ≤5 °C is a requirement for
food businesses, whereas this models a household kitchen as it actually is.
Modelling the standard rather than the reality would produce estimates that
are too generous, which is the unsafe direction.

**Consequence.** Figures sourced at 4 °C are converted *down*, shortening
them by roughly 28–37 %: milk 6 → 4 days, chicken 2 → 1, eggs 28 → 20.

## 2. Four-tier perishability naming is operational, not regulatory

The established food-science taxonomy is **three tiers** — perishable,
semi-perishable, shelf-stable. "Highly perishable" is a colloquial split of
the top tier.

**FSSAI does not define a four-tier taxonomy.** We use four operationally
because the top tier otherwise spans milk-and-fish through to cabbage, which
is too wide to band usefully. No regulatory provenance is claimed for it,
and none should be claimed in the report.

## 3. Q10 = 3 as the default, not Q10 = 2

Where no published activation energy exists, the temperature model uses
**Q10 = 3**, not the common "shelf life halves every 10 °C" rule (Q10 = 2).

Milk's measured Ea of 66.7 kJ/mol corresponds to Q10 ≈ 2.5, so Q10 = 2
**under-predicts** spoilage for dairy — it would tell someone food is still
good when it is not. In a 25–35 °C climate with intermittent refrigeration,
the conservative value is the correct default.

## 4. Model coverage is narrow, and the report must not imply otherwise

Of **70 rows**:

| Model | Rows |
|---|---|
| Arrhenius, with a published Ea | **4** (milk, chicken, fish, mutton) |
| Q10 = 3 fallback | **42** |
| No temperature model at all (`lookupOnly`) | **24** |

Arrhenius covers **four rows**. Everything else is either a generic Q10
approximation or excluded from temperature modelling entirely. Any claim
that the system is "Arrhenius-based" would materially overstate it.

Of those four activation energies, one (mutton) is a beef proxy the source
research itself flags as having an unverified journal, and one (milk) rests
on a weak anchor — see §7.

## 5. Relative band plus absolute ceiling — a design iteration

Neither rule works alone, and this is the clearest single illustration of
what the redesign fixed.

**Absolute-only** (the original `≤4 days = critical`) treated a 6-day loaf
and a 2-day fish identically, and turned a sealed 365-day bag of rice
"critical" for its last four days.

**Relative-only** (`≤10 % of shelf life remaining`) was worse in the other
direction: rice with **30 days left** is 8 % of its shelf life, so the card
would have told someone to eat a sealed bag of rice **today**. A percentage
is not urgency on its own.

**Shipped rule:** an absolute floor per tier, plus a relative band that only
applies within a per-tier ceiling. Strictest wins.

## 6. Rounding is always downward; confidence degrades

Estimates round **down**, never up. The harm is asymmetric: an estimate a day
short costs one sniff test, a day long costs the food.

A temperature-adjusted figure is **downgraded one confidence step**, because
an adjusted number is a scenario, not a measurement. `high → medium → low`.

## 7. Known-weak sources, kept visible

Weak provenance is recorded rather than laundered:

- **Milk Ea (66.7 kJ/mol)** — *Journal of Emerging Investigators*, which
  publishes secondary-school research reviewed by graduate-student
  volunteers. A real journal, but a weak anchor for the single number the
  temperature model leans on. Marked `confidence: "low"` with a caveat that
  renders in the UI, not just in the data file.
- **Poultry Ea (82 kJ/mol)** — Kritikos et al. studied *pomegranate-marinated
  chicken breast fillets*. Stated as a proxy, with an extrapolation warning.
- **Fish Ea (100 kJ/mol)** — a working value across a 49–154 kJ/mol range
  spanning species whose spoilage flora differ.
- **Chilling-injury thresholds** — the mechanism is not in dispute, the
  temperatures are unsourced. All 14 rows carry `min_safe_temp_c: null` and
  the app **declines to give fridge advice** for them rather than guessing.

See `CITATIONS_NEEDED.md` for the open items and the exact searches to run.

## 8. Data layer: typed modules, remote config deferred

Shelf-life values, keyword maps, activation energies and band thresholds live
in typed TypeScript modules (`src/lib/shelf-life-data.ts`,
`src/lib/text-match.ts`, `src/lib/risk-bands.ts`) rather than JSON.

The data layer is defined by **module boundary and schema**, not file format:
these modules contain data only, no logic, and every row is schema-checked at
compile time in a way a JSON file is not.

**Remote-fetched, hot-updatable config is a deferred Phase 5 item, not an
oversight.** Until then, updating a value is a code change with a
`data_version` bump and a `CHANGELOG.md` entry.

## 9. What this system does not model

- **Opened vs unopened.** Opening a pack resets the microbial clock; we do
  not track it.
- **Actual thermal history.** Power cuts, a hot car, a door left open — all
  invisible to us. Every adjusted number is a scenario.
- **Cooked food and leftovers.** Deliberately out of scope: the app tracks
  groceries bought, not meals cooked. Adding it would mean owning a
  *B. cereus* safety claim we cannot substantiate.
- **Regional variation.** Coastal Kerala and Delhi in June are not the same
  kitchen. One national baseline is an average.
- **Shelf life as a distribution.** The true spoilage time is a spread;
  a single day count is our summary of it.
