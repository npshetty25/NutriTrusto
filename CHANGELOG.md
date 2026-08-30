# Changelog — shelf-life data

Every change to a day value, an activation energy, a band threshold or a
confidence level is recorded here with the old value, the new value, and the
reason. Nothing changes silently.

---

## data_version 2026-08-31 — post-review hardening

### Confidence demotions (no day values changed)

| Row | Field | Old | New | Reason |
|---|---|---|---|---|
| `milk` | confidence | high | **low** | Ea anchored to *Journal of Emerging Investigators*, which publishes secondary-school research. Real journal, weak anchor for the model's keystone number. Value kept, caveat added and rendered. |
| `chicken` | confidence | high | **medium** | Kritikos et al. studied pomegranate-marinated chicken breast fillets, not poultry generally. Now stated as a proxy with an extrapolation warning. |
| `fish` | confidence | medium | **low** | Single working Ea (100 kJ/mol) applied across a 49–154 kJ/mol range spanning species whose spoilage flora differ with temperature. |
| `sugar` | confidence | high | **medium** | `source: "Food-science general"` is common knowledge, not a resolvable citation. Caught by the new citation lint. No citation invented — see `CITATIONS_NEEDED.md` §4. |
| `salt` | confidence | high | **medium** | As above. |
| `honey` | confidence | high | **medium** | As above. |

### Day value changes

| Row | Old | New | Reason |
|---|---|---|---|
| `bread` | 4 d @29 °C | **4 d @29 °C (unchanged)** | Value unchanged. Reclassified `lookupOnly: true` with `degradation_mode: "starch_retrogradation"`, so it no longer routes through Arrhenius or Q10. Confidence medium → **low**, since the figure is an unsourced household estimate. |

No other day value changed in this pass.

### Activation energies

None added, removed or altered. Coverage remains **4 of 70 rows**
(milk 66.7, chicken 82, fish 100, mutton 93). Two now carry
`extrapolation_warning`.

### Band thresholds

None changed in this pass. The relative-band ceiling introduced previously is
unchanged.

### Schema additions

- `id` — stable row identity. Tests assert on this, never on the day count
  alone: a day-count assertion passes when the *wrong* row matches but holds
  the same number, which is exactly how the "Tomatoes" plural bug hid.
- `data_version`, `effective_date` — stamped on every row at export.
- `chilling_sensitive { min_safe_temp_c, injury_mode, source, confidence }`
  on **14 rows**. All thresholds `null` / `TODO`; mechanism populated.
- `degradation_mode` — `starch_retrogradation` on `bread`.
- `source_caveat`, `extrapolation_warning`.

### Behavioural changes

- **Chilling injury.** The temperature model assumed colder is always longer.
  For tropical produce that is false above freezing. Unguarded, the
  "if stored differently" figures claimed a banana keeps **56 days** in the
  fridge against 5 on the counter, and a potato **314**. Chilling-sensitive
  rows now never report a longer life at a colder temperature; with no
  sourced threshold the app returns `null` and the UI says storage guidance
  is unavailable.

  *This panel was computed but never rendered, so no user was shown the bad
  advice. The defect was real but latent.*

- **Matchers unified.** `inferItemCategory` used bare `includes()` with no
  word boundaries and no exclusions — the identical defect fixed at tier 3
  and left in the tier-4 fallback. Both now share `matchesTerm` and one
  `FALSE_FRIENDS` list. Category order changed so bakery and frozen resolve
  before vegetable and dairy ("garlic bread" is bread; "ice cream" is frozen).

- **Provenance unified.** Was assembled twice — `CONFIDENCE_LABEL` in the
  scan result, a duplicated inline ternary in the card. They agreed by
  coincidence. One `formatProvenance()` now serves both, and it renders
  `source_caveat` so a weak anchor cannot be presented as sourced.

- **Colour semantics separated.** Diet, risk and confidence were sharing one
  palette. A "Non-Veg" chip rendered green with a tick, colliding with the
  mandated Indian vegetarian mark. A second instance of the same defect —
  raw `green-500/600/700` on the scanned-product sheet — painted any
  product's positives green regardless of diet. Both routed through
  `lib/colour-semantics.ts` and gated on diet status. Zero raw
  `green-\d{3}` classes remain in `page.tsx`.

- **Egg mark shape.** No longer a circle-in-square. That form is the
  vegetarian mark and is reserved for it; egg uses a diamond. Whether an
  official egg mark exists is an open question, recorded as a TODO rather
  than answered.

### Test suite

Added Vitest — the repo previously had **no tests and no runner**.
**107 tests** across three files: row-identity lookups, all seven
false-friend regressions at *both* tiers, a morphology corpus (plurals,
transliterations, casing, brand prefixes, quantity suffixes), tier-5 fallback,
chilling-injury invariants, bread bypass, citation lint, data hygiene,
confidence-downgrade chain, and colour semantics.

Plus a **poison test**: every day value is replaced with a unique sentinel and
the corpus re-run. Any test that still passes is keyed on row identity; any
that breaks was value-coupled. It carries its own vacuity guard, which earned
its keep immediately — it caught that `vi.resetModules()` was being called
before `vi.doMock()` rather than after, so the first version of the poison
test was not poisoning anything.
