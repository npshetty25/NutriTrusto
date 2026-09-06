import type { StorageLocation } from "@/lib/temperature";

/**
 * The sourced shelf-life baseline (Deliverables 1 and 2).
 *
 * Replaces 102 bare `name: number` pairs that carried no source, no storage
 * assumption and no confidence. Every row here can be audited: where the
 * figure came from, what temperature it is quoted at, and how much to trust
 * it.
 *
 * ── On the tier names ────────────────────────────────────────────────
 * The established food-science taxonomy is THREE tiers — perishable,
 * semi-perishable, shelf-stable. "Highly perishable" is a colloquial split
 * of the top tier, not an official FSSAI, Codex or USDA category. We use
 * four operationally because the top tier spans milk-and-fish through to
 * cabbage, but this file must never claim regulatory provenance for it.
 *
 * ── On reference temperatures ────────────────────────────────────────
 * `refTempC` is the temperature the `days` figure is quoted at, and it
 * differs by source:
 *
 *   refTempC 4  — taken from USDA FoodKeeper / FSIS, which assume a 4 °C
 *                 fridge. These get converted DOWN to the 7 °C an Indian
 *                 fridge actually runs at, shortening them ~28–37 %.
 *   refTempC 29 — an everyday Indian-household figure, already reflecting
 *                 counter or pantry storage. Multiplier 1.00, no conversion.
 *
 * Getting this per-row is what stops a counter-quoted 4-day spinach being
 * re-converted to 0.26 days.
 *
 * ── On confidence ────────────────────────────────────────────────────
 * Some sources in the underlying research are commercial pages rather than
 * authorities, and one activation energy is flagged by the research itself
 * as having an unverified journal. Those rows carry `confidence: "low"` and
 * name their source verbatim, so weak provenance stays visible instead of
 * being laundered into a table that looks uniformly authoritative.
 */

export type PerishTier = "highly-perishable" | "perishable" | "semi-perishable" | "shelf-stable";

export type Confidence = "high" | "medium" | "low";

export interface ShelfLifeRow {
  /**
   * Stable identity. What tests assert on.
   *
   * Written out per row, not derived from `keys[0]`. Under the derivation,
   * reordering or renaming a key silently renumbered the row, so a test
   * pinned to a row id could start passing against a different row without
   * anything in the diff looking like an identity change. It also forced the
   * id to name only the first key, which misdescribed the broad rows: the
   * `coconut-milk` row is really every shelf-stable plant milk and milk
   * powder.
   */
  id: string;
  data_version: string;
  effective_date: string;
  /** Terms matched against the item name, on word boundaries. */
  keys: string[];
  /**
   * Phrases that must NOT be treated as this row. "Coconut milk" is a
   * shelf-stable can, not milk; "paneer masala" is a spice packet, not
   * paneer. Checked before a match is accepted.
   */
  exclude?: string[];
  days: number;
  refTempC: number;
  storage: StorageLocation;
  tier: PerishTier;
  /** Published activation energy, kJ/mol, where one exists. */
  eaKJ?: number;
  /** Spoilage is not single-mechanism microbial — skip the temperature model. */
  lookupOnly?: boolean;
  source: string;
  confidence: Confidence;
  /**
   * Set where a source is being applied beyond the subject it studied, or
   * outside the temperature range it was fitted on. Rendered so the stretch
   * is visible rather than implied.
   */
  extrapolation_warning?: string;
  /** Why this source is weaker than its presence in the table suggests. */
  source_caveat?: string;
  /**
   * Tropical and subtropical produce suffers chilling injury well above
   * freezing: below a threshold it degrades FASTER in a fridge, not slower.
   * The temperature model assumes colder is always longer, which is false
   * for these rows.
   */
  chilling_sensitive?: {
    /** Below this, injury dominates. null = not yet sourced; see CITATIONS_NEEDED.md. */
    min_safe_temp_c: number | null;
    injury_mode: string;
    source: string;
    confidence: Confidence;
  };
  /**
   * Set when the dominant failure mode is not microbial growth. Bread stales
   * by starch retrogradation, which runs FASTEST just above freezing, so
   * refrigeration extends mould-free life while accelerating the failure a
   * person actually notices. Such rows must not go through Arrhenius or Q10.
   */
  degradation_mode?: "starch_retrogradation";
}

/**
 * Bumped whenever any figure in this file changes. Every row is stamped with
 * it at export, so a value can always be traced to the revision it came from.
 * See CHANGELOG.md for what moved and why.
 */
export const DATA_VERSION = "2026-09-07";
// Unchanged: no figure moved in the 2026-09-07 revision, only row identity.
export const EFFECTIVE_DATE = "2026-08-31";

const USDA = "USDA FoodKeeper";
const FSIS = "USDA FSIS";
const FAO = "FAO Quality and Quality Changes in Fresh Fish (v7180e)";
const IN_HOUSEHOLD = "Typical Indian household storage";

const RAW_ROWS: Omit<ShelfLifeRow, "data_version" | "effective_date">[] = [
  // ── Dairy ──────────────────────────────────────────────────────────
  // Quoted at 4 °C and converted down; these are the most-wasted items and
  // the ones where the old flat numbers were furthest out.
  {
    id: "milk",
    keys: ["milk", "doodh", "toned milk", "full cream milk"],
    // Every one of these is shelf-stable and was landing on milk's 3 days.
    exclude: ["coconut milk", "milk powder", "milk chocolate", "soy milk", "soya milk",
              "almond milk", "oat milk", "milkmaid", "condensed milk", "milk shake", "milkshake"],
    days: 6, refTempC: 4, storage: "fridge", tier: "highly-perishable",
    eaKJ: 66.7, source: `${USDA}; Ea from Xu & Sun, J. Emerging Investigators 2022`,
    // Demoted from "high". The Journal of Emerging Investigators is a real
    // journal, but it publishes secondary-school research reviewed by
    // graduate-student volunteers — too weak an anchor for the single number
    // the whole temperature model leans on. Kept rather than deleted, and
    // kept visible rather than quietly relied on. See CITATIONS_NEEDED.md.
    confidence: "low",
    source_caveat: "Journal of Emerging Investigators publishes secondary-school student research; anchor value pending replacement with a mainstream food-science source.",
  },
  {
    id: "curd",
    keys: ["curd", "dahi", "yogurt", "yoghurt"],
    exclude: ["curd rice"],
    days: 8, refTempC: 4, storage: "fridge", tier: "perishable",
    source: `${USDA} (yoghurt)`, confidence: "medium",
  },
  {
    id: "paneer",
    keys: ["paneer", "chhena", "cottage cheese"],
    // A spice packet, not a dairy block. This was resolving to 5 days.
    exclude: ["paneer masala", "shahi paneer masala", "paneer tikka masala"],
    days: 4, refTempC: 4, storage: "fridge", tier: "perishable",
    source: "ARCC review, Extension of Shelf Life of Paneer (fresh, untreated)", confidence: "medium",
  },
  {
    id: "cheese",
    keys: ["cheese", "mozzarella", "cheddar"],
    days: 21, refTempC: 4, storage: "fridge", tier: "semi-perishable",
    source: USDA, confidence: "medium",
  },
  {
    id: "cream",
    keys: ["cream", "malai"],
    exclude: ["cream biscuit", "ice cream", "cream cracker"],
    days: 7, refTempC: 4, storage: "fridge", tier: "perishable",
    source: USDA, confidence: "medium",
  },
  {
    id: "buttermilk",
    keys: ["buttermilk", "chaas", "lassi"],
    days: 5, refTempC: 4, storage: "fridge", tier: "highly-perishable",
    source: `${USDA} (cultured dairy)`, confidence: "low",
  },
  {
    id: "butter",
    keys: ["butter", "makhan"],
    exclude: ["peanut butter", "butter chicken", "butter paneer", "butter masala"],
    days: 60, refTempC: 4, storage: "fridge", tier: "semi-perishable",
    source: USDA, confidence: "medium",
  },
  {
    id: "ghee",
    keys: ["ghee"],
    days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable",
    lookupOnly: true, source: "Food-science general (rancidity-limited, not microbial)", confidence: "medium",
  },

  // ── Meat, fish, eggs ───────────────────────────────────────────────
  {
    id: "chicken",
    keys: ["chicken", "murgh"],
    exclude: ["chicken masala", "butter chicken", "chicken curry masala"],
    days: 2, refTempC: 4, storage: "fridge", tier: "highly-perishable",
    eaKJ: 82,
    // The study is on pomegranate-marinated chicken breast fillets, not
    // poultry in general. Stated as a proxy so the scope is not overstated.
    source: `${FSIS}; Ea from marinated chicken breast (Kritikos et al., Food Microbiology 55 (2016) 25-31); applied as poultry proxy`,
    extrapolation_warning: "Ea fitted on pomegranate-marinated chicken breast; applied to raw poultry generally",
    confidence: "medium",
  },
  {
    id: "fish",
    keys: ["fish", "machli", "prawn", "shrimp", "jhinga", "pomfret", "surmai",
           "rohu", "katla", "hilsa", "bangda", "crab"],
    exclude: ["fish curry masala", "fish masala", "fish oil"],
    days: 2, refTempC: 4, storage: "fridge", tier: "highly-perishable",
    eaKJ: 100, source: `${FAO}; Ea range 49-154 kJ/mol across species, 100 used as working value`,
    extrapolation_warning: "Single working Ea applied across species whose spoilage flora differ; FAO documents different microflora at 0-5 C and 15-30 C",
    confidence: "low",
  },
  {
    id: "mutton",
    keys: ["mutton", "lamb", "goat meat", "keema"],
    days: 4, refTempC: 4, storage: "fridge", tier: "highly-perishable",
    eaKJ: 93,
    // The research flags this Ea as having an unverified journal, so it is
    // recorded as a proxy and carries low confidence rather than being
    // presented as settled.
    source: `${FSIS}; Ea a beef-psychrotroph proxy, 85–103 kJ/mol, journal unverified`, confidence: "low",
  },
  {
    id: "egg",
    keys: ["egg", "eggs", "anda"],
    exclude: ["eggplant", "eggless", "egg curry masala"],
    days: 28, refTempC: 4, storage: "fridge", tier: "semi-perishable",
    source: USDA, confidence: "medium",
  },

  // ── Leafy greens and delicate vegetables ───────────────────────────
  // Quoted at Indian household conditions: these figures already reflect how
  // greens are actually kept here, so no conversion is applied.
  {
    id: "leafy-herbs",
    keys: ["coriander", "dhania", "kothmir", "methi", "fenugreek", "palak", "spinach",
           "pudina", "mint", "sarson", "bathua", "curry leaves", "kadi patta"],
    exclude: ["dhania powder", "coriander powder", "methi powder", "methi seeds"],
    days: 4, refTempC: 29, storage: "counter", tier: "highly-perishable",
    source: IN_HOUSEHOLD, confidence: "medium",
  },
  { id: "mushroom", keys: ["mushroom"], days: 5, refTempC: 29, storage: "counter", tier: "highly-perishable", source: IN_HOUSEHOLD, confidence: "medium" },
  { id: "lettuce", keys: ["lettuce"], days: 6, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { id: "spring-onion", keys: ["spring onion"], days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: IN_HOUSEHOLD, confidence: "low" },

  // ── Other vegetables ───────────────────────────────────────────────
  {
    id: "tomato",
    keys: ["tomato", "tamatar"], chilling_sensitive: { min_safe_temp_c: 10, injury_mode: "water soaking and softening, decay", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury) — ripe 7-10 C; mature-green 13 C", confidence: "high" },
    exclude: ["tomato ketchup", "tomato sauce", "tomato puree"],
    days: 7, refTempC: 29, storage: "counter", tier: "perishable",
    source: USDA, confidence: "medium",
  },
  { id: "bhindi", keys: ["bhindi", "okra", "lady finger"], chilling_sensitive: { min_safe_temp_c: 7, injury_mode: "discoloration, water-soaked areas, pitting, decay", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury) — listed as Okra", confidence: "high" }, days: 6, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { id: "capsicum", keys: ["capsicum", "bell pepper", "shimla mirch"], days: 10, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { id: "cauliflower", keys: ["cauliflower", "gobi", "broccoli"], days: 8, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { id: "cabbage", keys: ["cabbage", "patta gobi"], days: 14, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "medium" },
  { id: "beans", keys: ["beans", "french beans"], exclude: ["kidney beans", "rajma beans", "baked beans", "coffee beans"], days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { id: "brinjal", keys: ["brinjal", "baingan", "eggplant", "aubergine"], chilling_sensitive: { min_safe_temp_c: 7, injury_mode: "surface scald, alternaria rot, blackening of seeds", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury) — listed as Eggplants", confidence: "high" }, days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { id: "cucumber", keys: ["cucumber", "kheera"], chilling_sensitive: { min_safe_temp_c: 7, injury_mode: "pitting, water-soaked spots, decay", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury)", confidence: "high" }, days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { id: "carrot", keys: ["carrot", "gajar"], days: 14, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "medium" },
  { id: "beetroot", keys: ["beetroot", "chukandar"], days: 14, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "low" },
  { id: "peas", keys: ["peas", "matar"], exclude: ["frozen peas"], days: 5, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { id: "lauki", keys: ["lauki", "bottle gourd", "tinda", "tori"], days: 10, refTempC: 29, storage: "counter", tier: "perishable", source: IN_HOUSEHOLD, confidence: "low" },
  { id: "pumpkin", keys: ["pumpkin", "kaddu"], chilling_sensitive: { min_safe_temp_c: 10, injury_mode: "decay, especially alternaria rot", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury) — listed as Pumpkins and hardshell squash", confidence: "high" }, days: 21, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "low" },
  { id: "ginger", keys: ["ginger", "adrak"], chilling_sensitive: { min_safe_temp_c: 7, injury_mode: "softening, tissue breakdown, decay", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury)", confidence: "high" }, exclude: ["ginger garlic paste", "ginger powder", "dry ginger"], days: 21, refTempC: 29, storage: "counter", tier: "semi-perishable", source: IN_HOUSEHOLD, confidence: "medium" },
  {
    id: "garlic",
    keys: ["garlic", "lehsun"],
    // "Garlic bread" was matching garlic and getting 30 days. It is bread.
    exclude: ["garlic bread", "garlic naan", "ginger garlic paste", "garlic powder"],
    days: 30, refTempC: 29, storage: "counter", tier: "semi-perishable",
    source: "FAO Farm Structures Ch. 9", confidence: "medium",
  },
  { id: "onion", keys: ["onion", "pyaz", "pyaaz"], exclude: ["onion pickle", "spring onion", "onion powder"], days: 30, refTempC: 29, storage: "counter", tier: "semi-perishable", source: "FAO Farm Structures Ch. 9", confidence: "medium" },
  { id: "potato", keys: ["potato", "aloo"], chilling_sensitive: { min_safe_temp_c: 3, injury_mode: "mahogany browning, cold-induced sweetening", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury)", confidence: "high" }, exclude: ["potato chips", "sweet potato", "potato wafers"], days: 28, refTempC: 29, storage: "counter", tier: "semi-perishable", source: "FAO Farm Structures Ch. 9", confidence: "medium" },
  { id: "sweet-potato", keys: ["sweet potato", "shakarkandi"], chilling_sensitive: { min_safe_temp_c: 13, injury_mode: "decay, pitting, internal discoloration, hardcore when cooked", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury)", confidence: "high" }, days: 21, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "low" },

  // ── Fruit ──────────────────────────────────────────────────────────
  { id: "banana", keys: ["banana", "kela"], chilling_sensitive: { min_safe_temp_c: 13, injury_mode: "dull colour when ripened", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury) — 11.5-13 C range; 13 used", confidence: "high" }, days: 5, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { id: "papaya", keys: ["papaya"], chilling_sensitive: { min_safe_temp_c: 7, injury_mode: "pitting, failure to ripen, off flavours, decay", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury)", confidence: "high" }, days: 5, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "low" },
  { id: "mango", keys: ["mango", "aam"], chilling_sensitive: { min_safe_temp_c: 13, injury_mode: "greyish scald-like skin discoloration, uneven ripening", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury) — 10-13 C range; 13 used", confidence: "high" }, exclude: ["mango pickle", "aam achar", "mango juice"], days: 6, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { id: "grapes", keys: ["grapes", "angoor"], days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { id: "guava", keys: ["guava", "amrood"], chilling_sensitive: { min_safe_temp_c: 4.5, injury_mode: "pulp injury, decay", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury)", confidence: "high" }, days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: IN_HOUSEHOLD, confidence: "low" },
  { id: "pomegranate", keys: ["pomegranate", "anar"], days: 14, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "low" },
  { id: "orange", keys: ["orange", "mosambi", "santra"], chilling_sensitive: { min_safe_temp_c: 3, injury_mode: "pitting, brown stain", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury)", confidence: "high" }, exclude: ["orange juice"], days: 14, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "medium" },
  { id: "apple", keys: ["apple", "seb"], exclude: ["apple juice", "custard apple", "pineapple"], days: 21, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "medium" },
  { id: "lemon", keys: ["lemon", "nimbu", "lime"], chilling_sensitive: { min_safe_temp_c: 13, injury_mode: "pitting, membranous staining, red blotch", source: "USDA Agriculture Handbook 66, Table 1 (Fresh produce susceptible to chilling injury) — 11-13 C range; 13 used", confidence: "high" }, days: 21, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "medium" },

  // ── Bakery ─────────────────────────────────────────────────────────
  {
    id: "bread",
    keys: ["bread", "pav", "bun", "garlic bread"],
    exclude: ["bread crumbs", "breadcrumb"],
    days: 4, refTempC: 29, storage: "counter", tier: "perishable",
    // Bread does not fail microbially first. Starch retrogradation runs
    // FASTEST just above freezing, so a fridge extends mould-free life while
    // accelerating the staling a person actually notices. Neither Arrhenius
    // nor Q10 describes that, so this row is lookup-only.
    degradation_mode: "starch_retrogradation",
    lookupOnly: true,
    source: IN_HOUSEHOLD, confidence: "low",
  },
  { id: "roti", keys: ["roti", "chapati", "paratha", "naan"], days: 2, refTempC: 29, storage: "counter", tier: "highly-perishable", source: IN_HOUSEHOLD, confidence: "low" },
  { id: "cake", keys: ["cake", "pastry", "muffin"], days: 5, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "low" },

  // ── Dry staples ────────────────────────────────────────────────────
  // The category the old flat 30-day default hurt most: a sealed bag of rice
  // was going "Critical" while perfectly good.
  { id: "rice", keys: ["rice", "chawal", "basmati"], exclude: ["rice flour", "curd rice", "fried rice", "rice bran oil"], days: 365, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "high" },
  { id: "atta", keys: ["atta", "wheat flour"], days: 120, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "medium" },
  { id: "maida", keys: ["maida", "flour", "rice flour"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "medium" },
  { id: "dal", keys: ["dal", "toor dal", "arhar", "moong", "masoor", "urad", "chana", "chole"], exclude: ["dal fry", "dal makhani"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage (pulses 1 yr+)", confidence: "high" },
  { id: "rajma", keys: ["rajma", "kidney beans"], days: 240, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "high" },
  { id: "besan", keys: ["besan", "gram flour"], days: 120, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "medium" },
  { id: "poha", keys: ["poha", "suji", "rava", "semolina"], days: 120, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "medium" },
  { id: "oats", keys: ["oats"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "medium" },
  { id: "sugar", keys: ["sugar", "cheeni"], days: 540, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (indefinite if dry)", confidence: "medium" },
  { id: "salt", keys: ["salt", "namak"], days: 1080, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (indefinite)", confidence: "medium" },
  { id: "oil", keys: ["oil", "tel"], exclude: ["fish oil", "oil pulling"], days: 270, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (rancidity-limited)", confidence: "medium" },
  { id: "honey", keys: ["honey", "shahad"], days: 720, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (indefinite)", confidence: "medium" },

  // ── Preserved, frozen, packaged ────────────────────────────────────
  { id: "pickle", keys: ["pickle", "achar", "achaar"], days: 240, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (sealed)", confidence: "medium" },
  { id: "jam", keys: ["jam", "marmalade"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (sealed)", confidence: "medium" },
  { id: "ketchup", keys: ["ketchup", "sauce", "chutney"], exclude: ["soy sauce"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (sealed)", confidence: "medium" },
  { id: "peanut-butter", keys: ["peanut butter"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general", confidence: "medium" },
  { id: "plant-milk-and-powder", keys: ["coconut milk", "milk powder", "condensed milk", "milkmaid", "soy milk", "soya milk", "almond milk", "oat milk"], days: 365, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (UHT/canned, sealed)", confidence: "medium" },
  { id: "frozen", keys: ["frozen", "frozen peas", "ice cream"], days: 90, refTempC: -18, storage: "freezer", tier: "shelf-stable", lookupOnly: true, source: `${USDA} (freezer −18 °C)`, confidence: "medium" },
  { id: "biscuit", keys: ["biscuit", "cookie", "namkeen", "chips", "wafers"], days: 120, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (sealed, rancidity-limited)", confidence: "medium" },
  { id: "chocolate", keys: ["chocolate"], days: 240, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general", confidence: "medium" },
  { id: "tea", keys: ["tea", "chai patti"], days: 540, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general", confidence: "medium" },
  { id: "coffee", keys: ["coffee"], days: 365, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general", confidence: "medium" },
  {
    id: "ground-spices",
    keys: ["masala", "spice", "haldi", "turmeric", "jeera", "cumin", "mirch",
           "garam masala", "hing", "elaichi", "dhania powder", "coriander powder"],
    days: 365, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true,
    source: "Food-science general (whole spices 1–2 yr)", confidence: "medium",
  },
  { id: "juice", keys: ["juice"], days: 7, refTempC: 4, storage: "fridge", tier: "perishable", source: USDA, confidence: "low" },
];

/**
 * Every row carries a stable id and the data version it came from. The id is
 * what tests assert on: a test that checks only the returned day count
 * passes when the WRONG row is matched but happens to hold the same number,
 * which is exactly how the "Tomatoes" plural bug stayed hidden.
 */
export const SHELF_LIFE_ROWS: ShelfLifeRow[] = RAW_ROWS.map((row) => ({
  ...row,
  data_version: DATA_VERSION,
  effective_date: EFFECTIVE_DATE,
}));

// Ids are hand-written, so nothing but this stops two rows sharing one. A
// duplicate would make a row-id assertion ambiguous, which is the failure
// explicit ids exist to prevent.
const DUPLICATE_IDS = SHELF_LIFE_ROWS.map((r) => r.id).filter(
  (id, i, all) => all.indexOf(id) !== i
);
if (DUPLICATE_IDS.length > 0) {
  throw new Error(`shelf-life-data: duplicate row ids: ${[...new Set(DUPLICATE_IDS)].join(", ")}`);
}

/**
 * Longest key first, so "toor dal" beats "dal" and "sweet potato" beats
 * "potato". Precomputed once rather than sorted on every lookup.
 */
export const ROWS_BY_KEY_LENGTH: { key: string; row: ShelfLifeRow }[] = SHELF_LIFE_ROWS
  .flatMap((row) => row.keys.map((key) => ({ key: key.toLowerCase(), row })))
  .sort((a, b) => b.key.length - a.key.length);
