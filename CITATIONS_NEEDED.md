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

## 2. Chilling-injury thresholds — CLOSED

Sourced to **USDA Agriculture Handbook 66, Table 1** ("Fresh produce
susceptible to chilling injury when stored at low but nonfreezing
temperatures"), fetched and extracted directly rather than cited from memory.
All 14 rows now carry `min_safe_temp_c`, `confidence: "high"`.

Where the handbook gives a range, the **higher** figure is used — injury may
occur below it, so the higher end is the conservative choice:

| Commodity | Threshold | Injury (Handbook 66) |
|---|---|---|
| Banana | 13 °C | Dull colour when ripened |
| Tomato (ripe) | 10 °C | Water soaking and softening, decay |
| Mango | 13 °C | Greyish scald-like discolouration, uneven ripening |
| Potato | 3 °C | Mahogany browning, cold-induced sweetening |
| Brinjal (Eggplant) | 7 °C | Surface scald, alternaria rot, blackened seeds |
| Bhindi (Okra) | 7 °C | Discolouration, water-soaked areas, pitting, decay |
| Cucumber | 7 °C | Pitting, water-soaked spots, decay |
| Orange | 3 °C | Pitting, brown stain |
| Lemon | 13 °C | Pitting, membranous staining, red blotch |
| Sweet potato | 13 °C | Decay, pitting, internal discolouration, hardcore |
| Ginger | 7 °C | Softening, tissue breakdown, decay |
| Pumpkin | 10 °C | Decay, especially alternaria rot |
| Papaya | 7 °C | Pitting, failure to ripen, off flavours, decay |
| Guava | 4.5 °C | Pulp injury, decay |

**Consequence found while closing this item, not before:** potato's
threshold (3 °C) is *below* our 7 °C fridge assumption, so the chilling
guard correctly allows a fridge estimate through — and the generic Q10 = 3
fallback then returned **314 days**, an 11× extrapolation across a 22 °C
span neither model is fitted to defend. See §7 below.

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

## 7. Extrapolation cap — no citation needed, recorded for completeness

Not an open item, but worth recording alongside the others: `temperature.ts`
now defines `MAX_EXTRAPOLATION_SPAN_C = 12`. A row on the generic Q10 = 3
fallback is not converted across a wider gap than this — the honest answer
beyond it is "we don't know," not a number with three significant figures.
A row with a **published** activation energy (milk, chicken, fish, mutton)
is exempt, since a measured Ea is fitted across a real experimental range and
a rule of thumb is not.

This is a modelling decision, not a fact requiring a citation, but it exists
specifically because the potato case (item 2) proved the rule of thumb alone
was not enough.
