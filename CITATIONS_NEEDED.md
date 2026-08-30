# Citations needed

Open sourcing items. Each has the exact search a human should run.

**Rule: do not close one of these with something that looks close enough.**
An honest `TODO` is fine. A plausible-looking reference that turns out not to
say what we claimed is an academic-integrity problem, and in a project called
Nutri-*Trust* it is the wrong failure to have.

Until an item is closed, the code keeps `source: "TODO"`,
`confidence: "low"`, and the affected feature is suppressed rather than
guessed.

---

## 1. Milk activation energy — replace the anchor

**Current:** 66.7 kJ/mol, from Xu & Sun, *Journal of Emerging Investigators*,
Dec 2022.

**Problem:** JEI publishes original research by middle- and high-school
students, reviewed by graduate-student volunteers. It is a real journal and
the value is plausible, but it is a weak anchor for the single number the
whole temperature model rests on.

**Search:** `activation energy pasteurized milk shelf life psychrotrophic Arrhenius`

**Target journals:** *Journal of Dairy Science*, *Food Control*,
*International Dairy Journal*.

**On close:** replace `eaKJ`, remove `source_caveat`, raise `confidence`,
bump `DATA_VERSION`, record old → new in `CHANGELOG.md`.

## 2. Chilling-injury thresholds — 14 rows, all unsourced

The mechanism is not in dispute; the temperatures are. Every row below has
`chilling_sensitive.min_safe_temp_c: null`, and the app **declines to give
fridge or freezer advice** for them until a threshold is sourced.

Rows: banana, tomato, mango, potato, brinjal, bhindi/okra, cucumber, orange,
lemon, sweet potato, ginger, pumpkin, papaya, guava.

**Search:** `chilling injury threshold temperature <commodity> postharvest storage`

**Starting points — verify before quoting, do not cite from memory:**
- USDA Agriculture Handbook 66, *The Commercial Storage of Fruits,
  Vegetables, and Florist and Nursery Stocks* — has chilling-injury tables.
- FAO postharvest handling guidance.

**On close:** set `min_safe_temp_c`, replace `source: "TODO"`, set a real
confidence. The engine then compares it against the 7 °C fridge assumption
automatically; no code change needed.

## 3. Bread staling rate — currently an unsourced household figure

**Current:** 4 days at 29 °C, `source: "Typical Indian household storage"`,
`confidence: "low"`.

Bread is excluded from Arrhenius and Q10 because starch retrogradation runs
fastest just above freezing, so refrigeration extends mould-free life while
accelerating the staling a person actually notices. That mechanism is
settled; the day figure is not sourced.

**Search:** `starch retrogradation bread staling rate storage temperature kinetics`

## 4. Sugar, salt and honey — demoted for lack of a resolvable source

These carried `confidence: "high"` with `source: "Food-science general"`,
which the citation lint correctly rejected: common knowledge is not a
citation. Demoted to `medium` rather than invent one.

**Search:** `shelf stable dry goods storage life sugar salt honey <authority>`

**Target:** USDA dry-goods storage guidance, or FDA shelf-stable food
guidance.

## 5. FSSAI egg mark — does an official one exist?

We do **not** know whether the Food Safety and Standards (Packaging and
Labelling) Regulations define a mark for egg-containing food, and the code
does not claim either way.

Egg currently renders as a **diamond**, deliberately not the circle-in-square
used for the vegetarian mark, because reusing a mandated symbol for a
different meaning is the same class of error as the green non-veg chip.

**Search:** `FSS Packaging and Labelling Regulations vegetarian non-vegetarian symbol egg`

**Resolve before** the report or any UI copy asserts what the regulations
require.

## 6. Mutton / red-meat activation energy

**Current:** 93 kJ/mol, described as a beef-psychrotroph proxy across an
85–103 kJ/mol range. The source research flags this one as having an
unverified journal.

**Search:** `activation energy specific growth rate psychrotrophic beef Arrhenius Gompertz`

**On close:** if no sound source is found, consider removing `eaKJ` entirely
and letting the row fall back to Q10 = 3, which is more conservative than an
Ea we cannot stand behind.
