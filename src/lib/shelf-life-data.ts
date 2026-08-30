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
}

const USDA = "USDA FoodKeeper";
const FSIS = "USDA FSIS";
const FAO = "FAO Quality and Quality Changes in Fresh Fish (v7180e)";
const IN_HOUSEHOLD = "Typical Indian household storage";

export const SHELF_LIFE_ROWS: ShelfLifeRow[] = [
  // ── Dairy ──────────────────────────────────────────────────────────
  // Quoted at 4 °C and converted down; these are the most-wasted items and
  // the ones where the old flat numbers were furthest out.
  {
    keys: ["milk", "doodh", "toned milk", "full cream milk"],
    // Every one of these is shelf-stable and was landing on milk's 3 days.
    exclude: ["coconut milk", "milk powder", "milk chocolate", "soy milk", "soya milk",
              "almond milk", "oat milk", "milkmaid", "condensed milk", "milk shake", "milkshake"],
    days: 6, refTempC: 4, storage: "fridge", tier: "highly-perishable",
    eaKJ: 66.7, source: `${USDA}; Ea from Xu & Sun, J. Emerging Investigators 2022`, confidence: "high",
  },
  {
    keys: ["curd", "dahi", "yogurt", "yoghurt"],
    exclude: ["curd rice"],
    days: 8, refTempC: 4, storage: "fridge", tier: "perishable",
    source: `${USDA} (yoghurt)`, confidence: "medium",
  },
  {
    keys: ["paneer", "chhena", "cottage cheese"],
    // A spice packet, not a dairy block. This was resolving to 5 days.
    exclude: ["paneer masala", "shahi paneer masala", "paneer tikka masala"],
    days: 4, refTempC: 4, storage: "fridge", tier: "perishable",
    source: "ARCC review, Extension of Shelf Life of Paneer (fresh, untreated)", confidence: "medium",
  },
  {
    keys: ["cheese", "mozzarella", "cheddar"],
    days: 21, refTempC: 4, storage: "fridge", tier: "semi-perishable",
    source: USDA, confidence: "medium",
  },
  {
    keys: ["cream", "malai"],
    exclude: ["cream biscuit", "ice cream", "cream cracker"],
    days: 7, refTempC: 4, storage: "fridge", tier: "perishable",
    source: USDA, confidence: "medium",
  },
  {
    keys: ["buttermilk", "chaas", "lassi"],
    days: 5, refTempC: 4, storage: "fridge", tier: "highly-perishable",
    source: `${USDA} (cultured dairy)`, confidence: "low",
  },
  {
    keys: ["butter", "makhan"],
    exclude: ["peanut butter", "butter chicken", "butter paneer", "butter masala"],
    days: 60, refTempC: 4, storage: "fridge", tier: "semi-perishable",
    source: USDA, confidence: "medium",
  },
  {
    keys: ["ghee"],
    days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable",
    lookupOnly: true, source: "Food-science general (rancidity-limited, not microbial)", confidence: "medium",
  },

  // ── Meat, fish, eggs ───────────────────────────────────────────────
  {
    keys: ["chicken", "murgh"],
    exclude: ["chicken masala", "butter chicken", "chicken curry masala"],
    days: 2, refTempC: 4, storage: "fridge", tier: "highly-perishable",
    eaKJ: 82, source: `${FSIS}; Ea from Kritikos et al., Food Microbiology 55 (2016)`, confidence: "high",
  },
  {
    keys: ["fish", "machli", "prawn", "shrimp", "jhinga", "pomfret", "surmai",
           "rohu", "katla", "hilsa", "bangda", "crab"],
    exclude: ["fish curry masala", "fish masala", "fish oil"],
    days: 2, refTempC: 4, storage: "fridge", tier: "highly-perishable",
    eaKJ: 100, source: `${FAO}; Ea range 49–154 kJ/mol, 100 used as working value`, confidence: "medium",
  },
  {
    keys: ["mutton", "lamb", "goat meat", "keema"],
    days: 4, refTempC: 4, storage: "fridge", tier: "highly-perishable",
    eaKJ: 93,
    // The research flags this Ea as having an unverified journal, so it is
    // recorded as a proxy and carries low confidence rather than being
    // presented as settled.
    source: `${FSIS}; Ea a beef-psychrotroph proxy, 85–103 kJ/mol, journal unverified`, confidence: "low",
  },
  {
    keys: ["egg", "eggs", "anda"],
    exclude: ["eggplant", "eggless", "egg curry masala"],
    days: 28, refTempC: 4, storage: "fridge", tier: "semi-perishable",
    source: USDA, confidence: "medium",
  },

  // ── Leafy greens and delicate vegetables ───────────────────────────
  // Quoted at Indian household conditions: these figures already reflect how
  // greens are actually kept here, so no conversion is applied.
  {
    keys: ["coriander", "dhania", "kothmir", "methi", "fenugreek", "palak", "spinach",
           "pudina", "mint", "sarson", "bathua", "curry leaves", "kadi patta"],
    exclude: ["dhania powder", "coriander powder", "methi powder", "methi seeds"],
    days: 4, refTempC: 29, storage: "counter", tier: "highly-perishable",
    source: IN_HOUSEHOLD, confidence: "medium",
  },
  { keys: ["mushroom"], days: 5, refTempC: 29, storage: "counter", tier: "highly-perishable", source: IN_HOUSEHOLD, confidence: "medium" },
  { keys: ["lettuce"], days: 6, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { keys: ["spring onion"], days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: IN_HOUSEHOLD, confidence: "low" },

  // ── Other vegetables ───────────────────────────────────────────────
  {
    keys: ["tomato", "tamatar"],
    exclude: ["tomato ketchup", "tomato sauce", "tomato puree"],
    days: 7, refTempC: 29, storage: "counter", tier: "perishable",
    source: USDA, confidence: "medium",
  },
  { keys: ["bhindi", "okra", "lady finger"], days: 6, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { keys: ["capsicum", "bell pepper", "shimla mirch"], days: 10, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { keys: ["cauliflower", "gobi", "broccoli"], days: 8, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { keys: ["cabbage", "patta gobi"], days: 14, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "medium" },
  { keys: ["beans", "french beans"], exclude: ["kidney beans", "rajma beans", "baked beans", "coffee beans"], days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { keys: ["brinjal", "baingan", "eggplant", "aubergine"], days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { keys: ["cucumber", "kheera"], days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { keys: ["carrot", "gajar"], days: 14, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "medium" },
  { keys: ["beetroot", "chukandar"], days: 14, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "low" },
  { keys: ["peas", "matar"], exclude: ["frozen peas"], days: 5, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { keys: ["lauki", "bottle gourd", "tinda", "tori"], days: 10, refTempC: 29, storage: "counter", tier: "perishable", source: IN_HOUSEHOLD, confidence: "low" },
  { keys: ["pumpkin", "kaddu"], days: 21, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "low" },
  { keys: ["ginger", "adrak"], exclude: ["ginger garlic paste", "ginger powder", "dry ginger"], days: 21, refTempC: 29, storage: "counter", tier: "semi-perishable", source: IN_HOUSEHOLD, confidence: "medium" },
  {
    keys: ["garlic", "lehsun"],
    // "Garlic bread" was matching garlic and getting 30 days. It is bread.
    exclude: ["garlic bread", "garlic naan", "ginger garlic paste", "garlic powder"],
    days: 30, refTempC: 29, storage: "counter", tier: "semi-perishable",
    source: "FAO Farm Structures Ch. 9", confidence: "medium",
  },
  { keys: ["onion", "pyaz", "pyaaz"], exclude: ["onion pickle", "spring onion", "onion powder"], days: 30, refTempC: 29, storage: "counter", tier: "semi-perishable", source: "FAO Farm Structures Ch. 9", confidence: "medium" },
  { keys: ["potato", "aloo"], exclude: ["potato chips", "sweet potato", "potato wafers"], days: 28, refTempC: 29, storage: "counter", tier: "semi-perishable", source: "FAO Farm Structures Ch. 9", confidence: "medium" },
  { keys: ["sweet potato", "shakarkandi"], days: 21, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "low" },

  // ── Fruit ──────────────────────────────────────────────────────────
  { keys: ["banana", "kela"], days: 5, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { keys: ["papaya"], days: 5, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "low" },
  { keys: ["mango", "aam"], exclude: ["mango pickle", "aam achar", "mango juice"], days: 6, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { keys: ["grapes", "angoor"], days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "medium" },
  { keys: ["guava", "amrood"], days: 7, refTempC: 29, storage: "counter", tier: "perishable", source: IN_HOUSEHOLD, confidence: "low" },
  { keys: ["pomegranate", "anar"], days: 14, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "low" },
  { keys: ["orange", "mosambi", "santra"], exclude: ["orange juice"], days: 14, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "medium" },
  { keys: ["apple", "seb"], exclude: ["apple juice", "custard apple", "pineapple"], days: 21, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "medium" },
  { keys: ["lemon", "nimbu", "lime"], days: 21, refTempC: 29, storage: "counter", tier: "semi-perishable", source: USDA, confidence: "medium" },

  // ── Bakery ─────────────────────────────────────────────────────────
  {
    keys: ["bread", "pav", "bun", "garlic bread"],
    exclude: ["bread crumbs", "breadcrumb"],
    days: 4, refTempC: 29, storage: "counter", tier: "perishable",
    source: IN_HOUSEHOLD, confidence: "medium",
  },
  { keys: ["roti", "chapati", "paratha", "naan"], days: 2, refTempC: 29, storage: "counter", tier: "highly-perishable", source: IN_HOUSEHOLD, confidence: "low" },
  { keys: ["cake", "pastry", "muffin"], days: 5, refTempC: 29, storage: "counter", tier: "perishable", source: USDA, confidence: "low" },

  // ── Dry staples ────────────────────────────────────────────────────
  // The category the old flat 30-day default hurt most: a sealed bag of rice
  // was going "Critical" while perfectly good.
  { keys: ["rice", "chawal", "basmati"], exclude: ["rice flour", "curd rice", "fried rice", "rice bran oil"], days: 365, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "high" },
  { keys: ["atta", "wheat flour"], days: 120, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "medium" },
  { keys: ["maida", "flour", "rice flour"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "medium" },
  { keys: ["dal", "toor dal", "arhar", "moong", "masoor", "urad", "chana", "chole"], exclude: ["dal fry", "dal makhani"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage (pulses 1 yr+)", confidence: "high" },
  { keys: ["rajma", "kidney beans"], days: 240, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "high" },
  { keys: ["besan", "gram flour"], days: 120, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "medium" },
  { keys: ["poha", "suji", "rava", "semolina"], days: 120, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "medium" },
  { keys: ["oats"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "USDA dry-goods storage", confidence: "medium" },
  { keys: ["sugar", "cheeni"], days: 540, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (indefinite if dry)", confidence: "high" },
  { keys: ["salt", "namak"], days: 1080, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (indefinite)", confidence: "high" },
  { keys: ["oil", "tel"], exclude: ["fish oil", "oil pulling"], days: 270, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (rancidity-limited)", confidence: "medium" },
  { keys: ["honey", "shahad"], days: 720, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (indefinite)", confidence: "high" },

  // ── Preserved, frozen, packaged ────────────────────────────────────
  { keys: ["pickle", "achar", "achaar"], days: 240, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (sealed)", confidence: "medium" },
  { keys: ["jam", "marmalade"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (sealed)", confidence: "medium" },
  { keys: ["ketchup", "sauce", "chutney"], exclude: ["soy sauce"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (sealed)", confidence: "medium" },
  { keys: ["peanut butter"], days: 180, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general", confidence: "medium" },
  { keys: ["coconut milk", "milk powder", "condensed milk", "milkmaid", "soy milk", "soya milk", "almond milk", "oat milk"], days: 365, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (UHT/canned, sealed)", confidence: "medium" },
  { keys: ["frozen", "frozen peas", "ice cream"], days: 90, refTempC: -18, storage: "freezer", tier: "shelf-stable", lookupOnly: true, source: `${USDA} (freezer −18 °C)`, confidence: "medium" },
  { keys: ["biscuit", "cookie", "namkeen", "chips", "wafers"], days: 120, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general (sealed, rancidity-limited)", confidence: "medium" },
  { keys: ["chocolate"], days: 240, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general", confidence: "medium" },
  { keys: ["tea", "chai patti"], days: 540, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general", confidence: "medium" },
  { keys: ["coffee"], days: 365, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true, source: "Food-science general", confidence: "medium" },
  {
    keys: ["masala", "spice", "haldi", "turmeric", "jeera", "cumin", "mirch",
           "garam masala", "hing", "elaichi", "dhania powder", "coriander powder"],
    days: 365, refTempC: 29, storage: "counter", tier: "shelf-stable", lookupOnly: true,
    source: "Food-science general (whole spices 1–2 yr)", confidence: "medium",
  },
  { keys: ["juice"], days: 7, refTempC: 4, storage: "fridge", tier: "perishable", source: USDA, confidence: "low" },
];

/**
 * Longest key first, so "toor dal" beats "dal" and "sweet potato" beats
 * "potato". Precomputed once rather than sorted on every lookup.
 */
export const ROWS_BY_KEY_LENGTH: { key: string; row: ShelfLifeRow }[] = SHELF_LIFE_ROWS
  .flatMap((row) => row.keys.map((key) => ({ key: key.toLowerCase(), row })))
  .sort((a, b) => b.key.length - a.key.length);
