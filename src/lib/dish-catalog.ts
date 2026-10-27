import { matchesTerm } from "@/lib/text-match";
import { getItemDietType, isDietConflict, normalizeDietPreference, type ItemDietType } from "@/lib/diet";

/**
 * Everyday Indian dishes the recipe generator is allowed to suggest.
 *
 * The recipe prompt used to ASK for a real dish; nothing checked that it was
 * one. Now the server picks candidates from this list — dishes whose defining
 * ingredients the pantry actually has — and the model must choose one of
 * them by name. A recipe naming a dish not offered, or leaving out a dish's
 * defining ingredient, is rejected and retried.
 *
 * `core` is what makes the dish that dish: each inner list is one ingredient,
 * with its common names (English, Hindi). Every core ingredient must appear
 * somewhere in the recipe. `extras` are pantry items that commonly go in, so
 * a dish that can also use them ranks higher. Staples the recipe may assume
 * (rice, atta, a basic dal, onion, tomato, ginger, garlic, spices) can be core
 * — they need not be in the pantry — but a dish only becomes a candidate when
 * at least one pantry item matches it.
 */

export interface KnownDish {
  name: string;
  core: string[][];
  extras: string[];
}

const POTATO = ["potato", "aloo"];
const PEAS = ["peas", "matar"];
const SPINACH = ["spinach", "palak"];
const PANEER = ["paneer"];
const CURD = ["curd", "dahi", "yoghurt", "yogurt"];
const EGG = ["egg", "eggs"];
const CAULIFLOWER = ["cauliflower", "gobi"];
const CARROT = ["carrot", "gajar"];
const MUSHROOM = ["mushroom"];
const CAPSICUM = ["capsicum", "bell pepper", "shimla mirch"];
const OKRA = ["okra", "bhindi", "lady finger"];
const BRINJAL = ["brinjal", "baingan", "eggplant", "aubergine"];
const CHICKEN = ["chicken"];
const FISH = ["fish", "rohu", "pomfret", "surmai", "basa", "tilapia", "salmon", "mackerel", "kingfish"];
const MILK = ["milk", "doodh"];
const RAVA = ["rava", "sooji", "semolina"];
const BESAN = ["besan", "gram flour"];
const CUCUMBER = ["cucumber", "kheera"];
const BANANA = ["banana", "kela"];
const RAW_BANANA = ["raw banana", "plantain", "kacha kela"];
const MANGO = ["mango", "aam"];
const COCONUT = ["coconut", "nariyal"];
const LEMON = ["lemon", "lime", "nimbu"];
const BREAD = ["bread", "pav", "bun"];
const CHEESE = ["cheese"];
const CORN = ["corn", "sweet corn", "bhutta", "makai"];
const NOODLES = ["noodles", "maggi"];
// No "orange": it would make "Orange Juice" a fruit-chaat ingredient.
const FRUIT = ["apple", ...BANANA, "papaya", "guava", "pomegranate", "grapes", "pineapple", "watermelon", "chikoo", "sapota", ...MANGO, "pear"];

export const DISH_CATALOG: KnownDish[] = [
  { name: "Palak Paneer", core: [SPINACH, PANEER], extras: ["tomato", "cream", "onion"] },
  { name: "Matar Paneer", core: [PANEER, PEAS], extras: ["tomato", "onion", "cream"] },
  { name: "Paneer Bhurji", core: [PANEER], extras: ["onion", "tomato", ...CAPSICUM] },
  { name: "Kadai Paneer", core: [PANEER, CAPSICUM], extras: ["onion", "tomato"] },
  { name: "Paneer Paratha", core: [PANEER], extras: ["onion", "coriander"] },
  { name: "Aloo Gobi", core: [POTATO, CAULIFLOWER], extras: [...PEAS, "tomato"] },
  { name: "Aloo Matar", core: [POTATO, PEAS], extras: ["tomato", "onion"] },
  { name: "Jeera Aloo", core: [POTATO], extras: ["coriander"] },
  { name: "Aloo Palak", core: [POTATO, SPINACH], extras: ["tomato", "onion"] },
  { name: "Aloo Paratha", core: [POTATO], extras: ["coriander", "onion"] },
  { name: "Bhindi Masala", core: [OKRA], extras: ["onion", "tomato"] },
  { name: "Baingan Bharta", core: [BRINJAL], extras: ["onion", "tomato", ...PEAS] },
  { name: "Lauki Chana Dal", core: [["lauki", "bottle gourd"]], extras: ["chana dal", "tomato"] },
  { name: "Cabbage Poriyal", core: [["cabbage", "patta gobi"]], extras: [...CARROT, "coconut"] },
  { name: "Gajar Matar", core: [CARROT, PEAS], extras: ["tomato"] },
  { name: "Mixed Vegetable Sabzi", core: [[...CARROT, "beans", ...PEAS, ...CAULIFLOWER, ...POTATO, ...CAPSICUM]], extras: [...CARROT, "beans", ...PEAS, ...CAULIFLOWER, ...POTATO, ...CAPSICUM, "tomato"] },
  { name: "Vegetable Pulao", core: [["rice"], [...CARROT, "beans", ...PEAS, ...CAULIFLOWER]], extras: [...CARROT, "beans", ...PEAS, ...CAULIFLOWER, ...POTATO] },
  { name: "Vegetable Khichdi", core: [["rice"], [...CARROT, ...PEAS, "beans", ...POTATO, ...SPINACH]], extras: [...CARROT, ...PEAS, "beans", ...POTATO, ...SPINACH, "tomato"] },
  { name: "Matar Pulao", core: [["rice"], PEAS], extras: ["onion"] },
  { name: "Dal Palak", core: [["dal", "toor dal", "moong dal", "masoor dal", "lentils"], SPINACH], extras: ["tomato", "garlic"] },
  { name: "Dal Tadka", core: [["dal", "toor dal", "arhar dal", "masoor dal", "lentils"]], extras: ["tomato", "onion", "garlic"] },
  { name: "Chana Masala", core: [["chickpeas", "chana", "kabuli chana"]], extras: ["onion", "tomato"] },
  { name: "Rajma", core: [["kidney beans", "rajma"]], extras: ["onion", "tomato"] },
  { name: "Kadhi", core: [[...CURD, "buttermilk", "chaas"], BESAN], extras: ["onion"] },
  { name: "Mixed Raita", core: [CURD], extras: ["cucumber", "onion", "tomato"] },
  { name: "Curd Rice", core: [CURD, ["rice"]], extras: ["cucumber", "carrot"] },
  { name: "Poha", core: [["poha", "flattened rice"]], extras: [...POTATO, ...PEAS, "onion", "peanuts"] },
  { name: "Upma", core: [RAVA], extras: [...CARROT, ...PEAS, "onion"] },
  { name: "Besan Chilla", core: [BESAN], extras: ["onion", "tomato", ...SPINACH] },
  { name: "Methi Thepla", core: [["methi", "fenugreek"]], extras: [] },
  { name: "Mushroom Masala", core: [MUSHROOM], extras: ["onion", "tomato", ...PEAS] },
  { name: "Mushroom Matar", core: [MUSHROOM, PEAS], extras: ["tomato"] },
  { name: "Tomato Rice", core: [["tomato"], ["rice"]], extras: ["onion", ...PEAS] },
  { name: "Rasam", core: [["tomato"]], extras: ["lemon", "coriander"] },
  { name: "Sambar", core: [["dal", "toor dal", "lentils"], ["drumstick", ...OKRA, ...BRINJAL, "pumpkin", ...CARROT, "lauki", "bottle gourd"]], extras: ["drumstick", ...OKRA, ...BRINJAL, "pumpkin", ...CARROT, "tomato"] },
  { name: "Thoran", core: [["cabbage", "beans", ...CARROT, "beetroot"]], extras: ["coconut"] },
  { name: "Bread Upma", core: [["bread"]], extras: ["onion", "tomato", ...CAPSICUM] },
  { name: "Rice Kheer", core: [MILK, ["rice"]], extras: ["cardamom", "nuts"] },
  { name: "Sooji Halwa", core: [RAVA], extras: [...MILK] },
  { name: "Gajar Halwa", core: [CARROT, MILK], extras: [] },
  { name: "Egg Bhurji", core: [EGG], extras: ["onion", "tomato"] },
  { name: "Egg Curry", core: [EGG], extras: ["onion", "tomato", ...POTATO] },
  { name: "Masala Omelette", core: [EGG], extras: ["onion", "tomato", ...CAPSICUM] },
  { name: "Chicken Curry", core: [CHICKEN], extras: ["onion", "tomato", ...POTATO, ...CURD] },
  { name: "Butter Chicken", core: [CHICKEN], extras: ["cream", "butter", "tomato"] },
  { name: "Chicken Biryani", core: [CHICKEN, ["rice"]], extras: [...CURD, "onion"] },
  { name: "Keema Matar", core: [["keema", "minced mutton", "minced meat", "mutton mince"], PEAS], extras: ["tomato", "onion"] },
  { name: "Mutton Curry", core: [["mutton", "goat", "lamb"]], extras: ["onion", "tomato", ...POTATO] },
  { name: "Fish Curry", core: [FISH], extras: ["tomato", "coconut"] },
  { name: "Fish Fry", core: [FISH], extras: [] },
  { name: "Prawn Masala", core: [["prawn", "shrimp"]], extras: ["onion", "tomato", "coconut"] },

  // Added after measuring: 68 of the 107 everyday benchmark items had no dish
  // at all, so a pantry of fruit, bread or a packet of oats got "none of the
  // dishes we know use these items" instead of a recipe. Still only real,
  // commonly cooked dishes — the point of the list is that nothing is invented.
  { name: "Kachumber Salad", core: [CUCUMBER], extras: ["tomato", "onion", ...LEMON] },
  { name: "Cucumber Raita", core: [CUCUMBER, CURD], extras: [] },
  { name: "Onion Pakoda", core: [["onion", "pyaz"], BESAN], extras: ["green chilli", "coriander"] },
  { name: "Lemon Rice", core: [LEMON, ["rice"]], extras: ["peanuts", "curry leaves"] },
  { name: "Coconut Chutney", core: [COCONUT], extras: ["green chilli", "curry leaves"] },
  { name: "Coconut Rice", core: [COCONUT, ["rice"]], extras: ["curry leaves", "peanuts"] },
  { name: "Hari Chutney", core: [["coriander", "dhania", "mint", "pudina"]], extras: ["green chilli", ...LEMON, "ginger"] },
  { name: "Raw Banana Fry", core: [RAW_BANANA], extras: [] },
  { name: "Banana Milkshake", core: [BANANA, MILK], extras: [] },
  { name: "Banana Sheera", core: [BANANA, RAVA], extras: [...MILK, "ghee"] },
  { name: "Fruit Chaat", core: [FRUIT], extras: [...FRUIT, ...LEMON] },
  { name: "Fruit Raita", core: [CURD, ["pomegranate", "pineapple", ...BANANA, "apple", "grapes"]], extras: [] },
  { name: "Mango Lassi", core: [MANGO, CURD], extras: [...MILK] },
  { name: "Aamras", core: [MANGO], extras: [...MILK] },
  { name: "Pav Bhaji", core: [["pav", "bun"], POTATO], extras: [...PEAS, ...CAPSICUM, "tomato", "butter", ...CAULIFLOWER] },
  { name: "Vada Pav", core: [["pav", "bun"], POTATO], extras: [] },
  { name: "Bread Pakora", core: [BREAD, BESAN], extras: [...POTATO] },
  { name: "Bombay Vegetable Sandwich", core: [BREAD], extras: [...CUCUMBER, "tomato", ...POTATO, ...CHEESE, "butter"] },
  { name: "Cheese Sandwich", core: [CHEESE, BREAD], extras: ["butter", "tomato", ...CAPSICUM] },
  { name: "Cheese Paratha", core: [CHEESE], extras: ["onion", ...CAPSICUM] },
  { name: "Tofu Bhurji", core: [["tofu"]], extras: ["onion", "tomato", ...CAPSICUM] },
  { name: "Soya Chunks Curry", core: [["soya chunks", "soya", "nutrela"]], extras: ["onion", "tomato", ...POTATO] },
  { name: "Soya Pulao", core: [["soya chunks", "soya", "nutrela"], ["rice"]], extras: [...PEAS, ...CARROT] },
  { name: "Masala Oats", core: [["oats"]], extras: [...CARROT, ...PEAS, "onion", "tomato"] },
  { name: "Oats Chilla", core: [["oats"]], extras: ["onion", "tomato", ...SPINACH] },
  { name: "Masala Maggi", core: [NOODLES], extras: [...PEAS, ...CARROT, ...CAPSICUM, "onion"] },
  { name: "Veg Hakka Noodles", core: [NOODLES], extras: [...CAPSICUM, "cabbage", ...CARROT, "spring onion"] },
  { name: "Masala Pasta", core: [["pasta", "macaroni", "penne"]], extras: [...CAPSICUM, "tomato", "onion", ...CHEESE] },
  { name: "Corn Chaat", core: [CORN], extras: ["onion", "tomato", ...LEMON] },
  { name: "Kanda Paat Sabzi", core: [["spring onion", "green onion", "hara pyaz"]], extras: ["besan"] },
  { name: "Atta Halwa", core: [["atta", "wheat flour"]], extras: ["ghee", "jaggery"] },
  { name: "Cornflakes Chivda", core: [["cornflakes"]], extras: ["peanuts", "curry leaves"] },
];

/** The diet a dish's own ingredients give it. */
export function dishDiet(dish: KnownDish): ItemDietType {
  return getItemDietType([...dish.core.flat(), ...dish.extras].join(", "));
}

const hasAny = (text: string, terms: string[]) => terms.some((t) => matchesTerm(text, t.toLowerCase()));

export interface DishCandidate {
  name: string;
  /** The pantry items this dish would use, most urgent first. */
  uses: string[];
  /** Defining ingredients that are neither in the pantry nor a basic staple: what would have to be bought. */
  toBuy: string[];
  score: number;
}

/**
 * What an Indian kitchen can be assumed to have, matching the recipe prompt's
 * "kitchen staples". A dish needing only these beyond the pantry needs no
 * shopping trip.
 */
const STAPLES = ["rice", "atta", "wheat flour", "dal", "toor dal", "arhar dal", "masoor dal", "lentils", "onion", "pyaz", "tomato", "ginger", "garlic", "besan", "gram flour", "rava", "sooji", "semolina"];
const isStaple = (slot: string[]) => slot.some((t) => STAPLES.includes(t));

/**
 * The dishes worth suggesting for this pantry: at least one pantry item must
 * be a core ingredient, the dish must fit the diet, and dishes already shown
 * are skipped. Ranked by how much urgent food each would use.
 */
export function selectDishCandidates(
  pantry: { name: string; daysLeft: number }[],
  dietaryPreference: string | undefined,
  avoidTitles: string[] = [],
  limit = 8
): DishCandidate[] {
  const diet = normalizeDietPreference(dietaryPreference);
  const avoid = new Set(avoidTitles.map((t) => t.trim().toLowerCase()));
  const weight = (days: number) => (days <= 2 ? 3 : days <= 5 ? 2 : 1);
  const items = [...pantry].sort((a, b) => a.daysLeft - b.daysLeft);

  const candidates: DishCandidate[] = [];
  for (const dish of DISH_CATALOG) {
    if (avoid.has(dish.name.toLowerCase())) continue;
    if (isDietConflict(diet, dishDiet(dish))) continue;

    const coreTerms = dish.core.flat();
    const usesCore = items.filter((i) => hasAny(i.name.toLowerCase(), coreTerms));
    if (usesCore.length === 0) continue;

    const uses = items.filter((i) => hasAny(i.name.toLowerCase(), [...coreTerms, ...dish.extras]));
    const allCoreInPantry = dish.core.every((slot) => items.some((i) => hasAny(i.name.toLowerCase(), slot)));
    // A dish that sends someone to the shop ranks below one they can cook now:
    // oats, Maggi and carrots used to get Gajar Matar (buy peas) over Masala
    // Oats, which uses two of the three and needs nothing.
    const toBuy = dish.core
      .filter((slot) => !isStaple(slot) && !items.some((i) => hasAny(i.name.toLowerCase(), slot)))
      .map((slot) => slot[0]);
    const score = uses.reduce((sum, i) => sum + weight(i.daysLeft), 0) + (allCoreInPantry ? 2 : 0) - 1.5 * toBuy.length;
    candidates.push({ name: dish.name, uses: uses.map((i) => i.name), toBuy, score });
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function findDish(name: string): KnownDish | null {
  const target = name.trim().toLowerCase();
  return DISH_CATALOG.find((d) => d.name.toLowerCase() === target) ?? null;
}

/**
 * The defining ingredients a recipe for this dish leaves out. Read from the
 * recipe's own ingredient lists — pantry, to-buy and staples — not its title
 * or steps, so naming "paneer" in a sentence does not count as using it.
 */
export function missingCoreIngredients(dish: KnownDish, ingredientLines: string[]): string[] {
  const text = ingredientLines.join(", ").toLowerCase();
  return dish.core.filter((slot) => !hasAny(text, slot)).map((slot) => slot[0]);
}
