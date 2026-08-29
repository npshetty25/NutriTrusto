import { inferItemCategory, type ItemCategory } from "@/lib/item-category";

/**
 * Estimates how long an item will keep, and says where the number came from.
 *
 * Every unscanned item used to get a flat 30 days. That put palak and
 * basmati rice on the same clock: the spinach showed "Still Good" for four
 * weeks while it rotted, and the rice went "Critical" while sealed in the
 * bag. A tracker whose headline number is wrong in both directions teaches
 * people to ignore it.
 *
 * The estimate is never presented as a fact. Every result carries a
 * `source`, and the UI shows it, so "we looked this up" and "we guessed
 * from the category" are visibly different claims — the same reason the
 * allergen badge degrades to "unknown" instead of "safe".
 */

export type ShelfLifeSource = "scanned" | "known" | "category" | "fallback";

export interface ShelfLifeEstimate {
  days: number;
  source: ShelfLifeSource;
  /** Short sentence for the UI. Always says how confident this is. */
  explanation: string;
  /** True when a human should be nudged to check it. */
  wantsConfirmation: boolean;
}

// Typical unopened shelf life from purchase, in days, at normal Indian
// household storage. Ordered longest-key-first at lookup time so "curd"
// does not match before "curd rice" would.
//
// These are conservative everyday figures, not laboratory values, and they
// are deliberately on the short side: telling someone food died a day early
// costs them one sniff test, telling them a day late costs them the food.
const KNOWN_SHELF_LIFE: Record<string, number> = {
  // Leafy and delicate — the items the whole product exists for
  "coriander": 4, "dhania": 4, "methi": 4, "palak": 4, "spinach": 4,
  "curry leaves": 7, "mint": 5, "pudina": 5, "lettuce": 6, "spring onion": 7,

  // Other vegetables
  "mushroom": 5, "tomato": 7, "bhindi": 6, "okra": 6, "capsicum": 10,
  "cauliflower": 8, "gobi": 8, "cabbage": 14, "beans": 7, "brinjal": 7,
  "eggplant": 7, "cucumber": 7, "carrot": 14, "beetroot": 14, "peas": 5,
  "lauki": 10, "bottle gourd": 10, "pumpkin": 21, "ginger": 21,
  "garlic": 30, "onion": 30, "potato": 28, "sweet potato": 21,

  // Fruit
  "banana": 5, "papaya": 5, "mango": 6, "grapes": 7, "guava": 7,
  "pomegranate": 14, "orange": 14, "apple": 21, "lemon": 21,

  // Dairy — short and the most commonly wasted
  "milk": 3, "curd": 7, "dahi": 7, "yogurt": 7, "paneer": 5,
  "cream": 7, "buttermilk": 5, "chaas": 5, "cheese": 21, "butter": 60,
  "ghee": 180,

  // Eggs and meat
  "egg": 21, "eggs": 21, "chicken": 2, "mutton": 2, "fish": 2,
  "prawn": 2, "shrimp": 2, "keema": 2,

  // Bakery
  "bread": 4, "pav": 4, "bun": 4, "roti": 2, "chapati": 2, "cake": 5,

  // Dry staples — the ones the flat 30-day default hurt most
  "rice": 365, "basmati": 365, "atta": 120, "maida": 180, "flour": 180,
  "dal": 180, "toor dal": 180, "moong": 180, "chana": 180, "rajma": 240,
  "sugar": 540, "salt": 1080, "poha": 120, "suji": 120, "rava": 120,
  "oats": 180, "besan": 120, "oil": 270, "honey": 720,

  // Preserved and frozen
  "pickle": 240, "achar": 240, "jam": 180, "ketchup": 180, "sauce": 180,
  "frozen peas": 90, "frozen": 90, "ice cream": 90,
  "biscuit": 180, "namkeen": 90, "chips": 90, "chocolate": 240,
  "tea": 540, "coffee": 365, "masala": 365, "spice": 365,
};

// Fallback by inferred category, used when the name matches nothing above.
const CATEGORY_SHELF_LIFE: Record<ItemCategory, number> = {
  vegetable: 7,
  fruit: 7,
  dairy: 7,
  meat: 2,
  bakery: 4,
  grain: 180,
  beverage: 90,
  frozen: 90,
  snack: 120,
  pantry: 180,
  unknown: 14,
};

// Used only when even the category is unknown. 14 rather than 30: an
// unknown item is more likely to be perishable than a sealed dry good, and
// an early warning is cheaper than a late one.
const FALLBACK_DAYS = 14;

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  vegetable: "vegetables", fruit: "fruit", dairy: "dairy", meat: "meat",
  bakery: "bakery items", grain: "grains", beverage: "drinks",
  frozen: "frozen food", snack: "snacks", pantry: "pantry staples",
  unknown: "similar items",
};

/**
 * @param name       the item's name as the user will see it
 * @param scannedDays days remaining read from a real printed expiry date,
 *                    when one was scanned. Always wins.
 */
export function estimateShelfLife(name: string, scannedDays?: number | null): ShelfLifeEstimate {
  if (typeof scannedDays === "number" && Number.isFinite(scannedDays) && scannedDays >= 0) {
    return {
      days: Math.round(scannedDays),
      source: "scanned",
      explanation: "Read from the expiry date printed on the pack.",
      wantsConfirmation: false,
    };
  }

  const text = (name || "").toLowerCase();

  // Longest key first, so "frozen peas" beats "peas" and "toor dal" beats
  // "dal". Substring matching is right here — these are food words, not
  // the diet keywords where "eggplant" mattered.
  const key = Object.keys(KNOWN_SHELF_LIFE)
    .filter((k) => text.includes(k))
    .sort((a, b) => b.length - a.length)[0];

  if (key) {
    return {
      days: KNOWN_SHELF_LIFE[key],
      source: "known",
      explanation: `Typical for ${key}. Change it if your pack says otherwise.`,
      wantsConfirmation: false,
    };
  }

  const category = inferItemCategory(name);
  if (category !== "unknown") {
    return {
      days: CATEGORY_SHELF_LIFE[category],
      source: "category",
      explanation: `Estimated from ${CATEGORY_LABEL[category]} — worth checking.`,
      wantsConfirmation: true,
    };
  }

  return {
    days: FALLBACK_DAYS,
    source: "fallback",
    explanation: "We could not tell what this is, so this is a guess. Please set it yourself.",
    wantsConfirmation: true,
  };
}

export const SHELF_LIFE_SOURCE_LABEL: Record<ShelfLifeSource, string> = {
  scanned: "From the pack",
  known: "Typical shelf life",
  category: "Estimated",
  fallback: "Guessed",
};
