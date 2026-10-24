import { FOODKEEPER, type FoodKeeperEntry } from "@/lib/foodkeeper-data";
import { matchesTerm } from "@/lib/text-match";
import { ASSUMED_STORAGE_C, adjustDays, type StorageLocation } from "@/lib/temperature";

/**
 * Lookup into the USDA FSIS FoodKeeper table (lib/foodkeeper-data.ts).
 *
 * FoodKeeper is broad — 612 products — but American, and its keyword lists
 * are written for a search box, not a matcher: "Eggplant" lists "egg", the
 * cheeses list "cheese", ham lists "half" and "whole". Matching on those would
 * give an aubergine the shelf life of eggs. So an item matches an entry only
 * through:
 *
 *   - the entry's own product name, split on "/" and "," ("Yams/sweet
 *     potatoes", "Shrimp, crayfish"), minus a short list of words that name a
 *     whole class of food or a state rather than a food ("fruit", "cut");
 *   - a multi-word keyword that contains a word of that name ("sour cream" for
 *     Sour cream), never a single loose keyword.
 *
 * Its figures assume a US home: a pantry near 21 °C and a fridge at 4 °C.
 * They are converted to the Indian storage we assume, by the same model and
 * with the same limits as our own table — and only for perishable figures. A
 * two-year bag of rice is quality-limited, not microbial, so it is used as is.
 */

export const FOODKEEPER_CITATION = "USDA FSIS FoodKeeper (data version 128)";

/** USDA's reference conditions for its "pantry" and "refrigerator" columns. */
const US_REF_C: Record<"counter" | "fridge", number> = { counter: 21, fridge: 4 };

/** Figures longer than this are quality-limited; the temperature model does not apply. */
const PERISHABLE_MAX_DAYS = 30;

/**
 * Name parts that name a class of food, a container or a state, not a food.
 * "Fruit, cut" would otherwise match every "cut" item; "Herbs" every herb.
 */
const NOT_A_FOOD_NAME = new Set([
  "fruit", "fruits", "vegetables", "vegetable", "greens", "herbs", "dinners", "base", "formula",
  "leftovers", "meats", "seafood", "fish", "dough", "cut", "boxes", "patties", "punch", "cocktail",
  "stuffed", "jars or pouches", "main dishes or meals", "canned goods", "variety meats",
  "whole", "fresh", "dried", "frozen", "canned", "homemade", "commercial",
]);

/**
 * Qualifier words that describe a prepared or altered state. An entry whose
 * qualifier says "cooked" is not the right figure for an item that does not:
 * "Quinoa" means the dry grain (two years), not "Quinoa, cooked" (four days).
 */
const STATE_WORDS = new Set(["cooked", "homemade", "prepared", "hydrated", "thawed", "opened", "squeezed"]);

/**
 * Categories whose long shelf figures are about rancidity, staling or
 * flavour, not microbes. The temperature model is not applied to them at
 * all, however short the figure — a Q10 conversion turned USDA's two weeks
 * for walnuts into five days.
 */
const NOT_TEMPERATURE_MODELLED = new Set([
  "Shelf Stable Foods", "Grains, Beans & Pasta", "Condiments, Sauces & Canned Goods", "Beverages",
  "Baked Goods / Baking and Cooking", "Meat / Shelf Stable Foods", "Poultry / Shelf Stable Foods",
]);

/** Frozen-food entries that are frozen by nature, so match without the word "frozen". */
const INHERENTLY_FROZEN = new Set(["ice cream", "ice pops", "sherbet, sorbet", "juice concentrates"]);

/** "Avocados" → "avocado", "Tomatoes" → "tomato", "Cherries" → "cherry". */
function singular(term: string): string | null {
  const m = /^(.*\s)?([a-z]+)$/.exec(term);
  if (!m) return null;
  const [, head = "", last] = m;
  let one: string | null = null;
  if (last.endsWith("ies") && last.length > 4) one = last.slice(0, -3) + "y";
  else if (last.endsWith("oes")) one = last.slice(0, -2);
  else if (last.endsWith("s") && !/(ss|us|is)$/.test(last) && last.length > 3) one = last.slice(0, -1);
  return one ? head + one : null;
}

/**
 * Words that mark a cooked or prepared dish. FoodKeeper's long figures are
 * for raw, dry or sealed products — "Fried rice" must not inherit two years
 * from "Rice, white", nor "Paneer curry" a dairy figure.
 */
const PREPARED_DISH_WORDS = [
  "fried", "cooked", "curry", "leftover", "leftovers", "biryani", "pulao", "sabzi", "gravy", "masala",
  "khichdi", "halwa", "kheer", "paratha", "dosa", "idli", "sambar", "rasam",
];

const FROZEN_CATEGORY = "Food Purchased Frozen";

interface Indexed {
  entry: FoodKeeperEntry;
  terms: string[];
  /** Words of the subtitle and keywords, for telling "Cheese, slices" from "Cheese, soft". */
  detail: Set<string>;
}

const words = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? [];

function termsFor(entry: FoodKeeperEntry): string[] {
  const name = entry.name.toLowerCase().replace(/"/g, "");
  const parts = name
    .replace(/\(([^)]*)\)/g, ",$1")
    .split(/[\/,]/)
    .map((p) => p.replace(/^\s*(and|or)\s+/, "").trim())
    .filter((p) => p.length >= 3 && !NOT_A_FOOD_NAME.has(p));
  const nameWords = new Set(words(name).filter((w) => w.length >= 3));
  const phrases = entry.keywords.filter(
    (k) => /\s/.test(k.trim()) && words(k).some((w) => nameWords.has(w)) && !NOT_A_FOOD_NAME.has(k.trim())
  );
  const terms = [...parts, ...phrases.map((k) => k.trim())];
  const singulars = terms.map(singular).filter((t): t is string => !!t && !NOT_A_FOOD_NAME.has(t));
  return [...new Set([...terms, ...singulars])];
}

const INDEX: Indexed[] = FOODKEEPER.map((entry) => ({
  entry,
  terms: termsFor(entry),
  detail: new Set([...words(entry.subtitle ?? ""), ...entry.keywords.flatMap(words)]),
}));

export interface FoodKeeperFigures {
  entry: FoodKeeperEntry;
  /** Storage the main figure is for. */
  storage: StorageLocation;
  /** The main figure, converted to Indian storage where that applies. */
  days: number;
  /** True when `days` was converted from USDA's reference temperature. */
  adjusted: boolean;
  /** USDA's own figure for each storage, converted the same way; null where USDA gives none. */
  byStorage: Record<StorageLocation, number | null>;
}

/** A USDA figure for one storage, converted to the Indian temperature we assume. */
function convert(
  days: number | null,
  storage: StorageLocation,
  category: string | null
): { days: number; adjusted: boolean } | null {
  if (!days) return null;
  if (storage === "freezer" || days > PERISHABLE_MAX_DAYS || NOT_TEMPERATURE_MODELLED.has(category ?? "")) {
    return { days, adjusted: false };
  }
  // Round down: a day short costs a look, a day long costs the food.
  const converted = Math.max(1, Math.floor(adjustDays(days, US_REF_C[storage], ASSUMED_STORAGE_C[storage])));
  return { days: converted, adjusted: converted !== days };
}

/**
 * The FoodKeeper figures for an entry. Frozen-food entries carry a freezer
 * figure only: their refrigerator column is "after cooking", which is not
 * how long the pack keeps.
 */
export function foodKeeperFigures(entry: FoodKeeperEntry): FoodKeeperFigures | null {
  const frozen = entry.category === FROZEN_CATEGORY;
  const byStorage: Record<StorageLocation, number | null> = {
    counter: frozen ? null : convert(entry.pantry, "counter", entry.category)?.days ?? null,
    fridge: frozen ? null : convert(entry.fridge, "fridge", entry.category)?.days ?? null,
    freezer: entry.freezer,
  };
  // Shelf first where USDA gives a pantry figure (that is where dry goods and
  // most produce sit in an Indian kitchen), then fridge, then freezer.
  const order: StorageLocation[] = ["counter", "fridge", "freezer"];
  const storage = order.find((s) => byStorage[s] !== null);
  if (!storage) return null;
  const raw = storage === "counter" ? entry.pantry : storage === "fridge" ? entry.fridge : entry.freezer;
  const main = convert(raw, storage, entry.category);
  if (!main) return null;
  return { entry, storage, days: main.days, adjusted: main.adjusted, byStorage };
}

/**
 * The FoodKeeper entry for an item name, or null.
 *
 * Several entries can share a name ("Cheese" has five). The longest matching
 * term wins; then the entry whose qualifier shares the most words with the
 * item ("Cheese Slices" → "processed slices"); then a frozen entry only when
 * the item says "frozen"; then the SHORTER figure, for the same asymmetric
 * reason as everywhere else in the estimate.
 */
export function findFoodKeeperEntry(name: string): FoodKeeperFigures | null {
  const text = (name || "").toLowerCase().trim();
  if (!text) return null;
  const itemWords = new Set(words(text));
  const wantsFrozen = itemWords.has("frozen");
  const prepared = PREPARED_DISH_WORDS.some((w) => matchesTerm(text, w));

  type Candidate = { figures: FoodKeeperFigures; termLen: number; frozenMismatch: number; stateMismatch: number; overlap: number };
  // Compared in order; lower is better for every key.
  const rank = (c: Candidate) => [-c.termLen, c.frozenMismatch, c.stateMismatch, -c.overlap, c.figures.days];
  const better = (a: Candidate, b: Candidate) => {
    const [ra, rb] = [rank(a), rank(b)];
    const i = ra.findIndex((v, k) => v !== rb[k]);
    return i !== -1 && ra[i] < rb[i];
  };

  let best: Candidate | null = null;
  for (const { entry, terms, detail } of INDEX) {
    const term = terms.filter((t) => matchesTerm(text, t)).sort((a, b) => b.length - a.length)[0];
    if (!term) continue;
    // Frozen by category ("Food Purchased Frozen") or by qualifier ("Bagel, commercially frozen").
    const isFrozenEntry = entry.category === FROZEN_CATEGORY || words(entry.subtitle ?? "").some((w) => w === "frozen");
    // A frozen product's figure is a freezer figure; "Pizza" is not "Pizza, frozen".
    if (isFrozenEntry && !wantsFrozen && !INHERENTLY_FROZEN.has(entry.name.trim().toLowerCase())) continue;
    const figures = foodKeeperFigures(entry);
    if (!figures) continue;
    if (prepared && entry.category !== "Deli & Prepared Foods" && figures.days > 7) continue;

    const termWords = new Set(words(term));
    const candidate: Candidate = {
      figures,
      termLen: term.length,
      frozenMismatch: isFrozenEntry === wantsFrozen ? 0 : 1,
      stateMismatch: words(entry.subtitle ?? "").filter((w) => STATE_WORDS.has(w) && !itemWords.has(w)).length,
      overlap: [...itemWords].filter((w) => detail.has(w) && !termWords.has(w)).length,
    };
    if (!best || better(candidate, best)) best = candidate;
  }
  return best?.figures ?? null;
}

/** "cheese (processed slices)", for explanations. */
export function foodKeeperLabel(entry: FoodKeeperEntry): string {
  const name = entry.name.trim().toLowerCase().replace(/"/g, "");
  return entry.subtitle ? `${name} (${entry.subtitle.trim()})` : name;
}

/**
 * USDA's "use within N days once opened" for an item kept in `storage`,
 * converted to Indian storage like every other figure. Null when USDA gives
 * none for that storage — the person then picks one themselves.
 */
export function openedDaysFor(name: string, storage: StorageLocation): { days: number; citation: string } | null {
  if (storage === "freezer") return null;
  const hit = findFoodKeeperEntry(name);
  if (!hit) return null;
  const raw = storage === "fridge" ? hit.entry.fridgeAfterOpening : hit.entry.pantryAfterOpening;
  const converted = convert(raw, storage, hit.entry.category);
  if (!converted) return null;
  return { days: converted.days, citation: `${FOODKEEPER_CITATION}: ${foodKeeperLabel(hit.entry)}` };
}
