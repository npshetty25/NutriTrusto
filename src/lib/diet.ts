/**
 * Diet classification for a single food item, by name and (where available)
 * its ingredient text.
 *
 * This lived inline in page.tsx, using substring matching, while a second
 * near-identical list in diet-check.ts used word boundaries. The two drifted,
 * and the page.tsx copy carried three real defects:
 *
 *   - "egg" matched with .includes(), so EGGPLANT and EGGLESS CAKE were
 *     both classified as containing egg. Brinjal is the most common
 *     vegetable in an Indian pantry and it was being flagged.
 *   - "stock" and "broth" were treated as meat, so VEGETABLE STOCK was
 *     flagged non-vegetarian. diet-check.ts had already excluded these for
 *     exactly that reason.
 *   - "ham" matched inside longer words.
 *
 * One list, one matcher, word boundaries throughout.
 */

import { matchesTerm, FALSE_FRIENDS } from "@/lib/text-match";

export type ItemDietType = "veg" | "egg" | "non-veg";
export type DietPreference = "veg" | "eggtarian" | "non-veg" | "none";

// Unambiguous animal terms only. Anything that has a common vegetarian
// sense — stock, broth, butter, cream — is deliberately absent: a false
// "non-veg" on someone's dal is worse than a missed edge case, because it
// trains them to ignore the warning.
export const ANIMAL_TERMS = [
  "chicken", "mutton", "lamb", "beef", "pork", "bacon", "ham", "sausage",
  "salami", "pepperoni", "turkey", "duck", "goat", "veal", "venison",
  // Fish by name, not just the word "fish". Found by testing the recipe
  // browser: "Smoked Haddock Kedgeree" passed as vegetarian because no list
  // contained "haddock".
  "fish", "salmon", "tuna", "anchovy", "sardine", "mackerel", "pomfret",
  "bonito", "haddock", "cod", "tilapia", "basa", "pollock", "herring",
  "trout", "snapper", "hilsa", "rohu", "katla", "surmai", "kingfish",
  "prawn", "shrimp", "crab", "lobster", "squid", "oyster",
  "clam", "mussel", "gelatin", "gelatine", "lard", "keema", "seekh",
  // Cured meats and seafood that appear in dish titles without any of the
  // words above. Found by running the ingredient check across four
  // cuisines and looking at what it removed.
  "chorizo", "prosciutto", "pancetta", "jamon", "calamari", "gambas",
  "hake", "liver", "offal", "brisket",
  // NOT "kidney": kidney bean is vegetarian and common in an Indian
  // kitchen. Same trap as "egg" in eggplant. The ingredient check catches
  // actual offal without needing the word in the title.
  "worcestershire", "rennet",
];

// Dishes that are egg without containing the word. "Bread omelette" was
// being shown to vegetarians for exactly this reason. Not "bhurji" — paneer
// bhurji is vegetarian and far more common in an Indian kitchen.
export const EGG_TERMS = [
  "egg", "eggs", "anda", "albumen", "mayonnaise",
  "omelette", "omelet", "frittata", "quiche",
];

// "Eggless" is an explicit claim that the product contains no egg, and it
// contains the word "egg". Checked before the egg terms so the claim wins.
const EGG_FREE_CLAIMS = ["eggless", "egg-free", "egg free"];

/**
 * Whole-word match that also accepts a plural.
 *
 * This was a bare `\b<term>\b` regex, which fails on every plural, because
 * the trailing "s" is itself a word character. Since ANIMAL_TERMS spells out
 * no plurals at all, that made the vegetarian check pass "Prawns",
 * "Sausages", "Chickens", "Oysters", "Crabs" and "Sardines" — it only ever
 * caught the singular. `EGG_TERMS` was unaffected only because it happens to
 * list "egg" and "eggs" by hand.
 *
 * A comment in shelf-life.ts used to claim the missing plural rule here was
 * deliberate, on the grounds that widening it would reintroduce the
 * "eggplant" bug. It does not: `matchesTerm` extends a match by "s" or "es"
 * only, so "eggplant" and "eggless" still fail on the following consonant.
 * That is covered by tests in diet.test.ts.
 */
export const hasWord = (haystack: string, term: string) =>
  matchesTerm(haystack.toLowerCase(), term.toLowerCase());

export const normalizeDietPreference = (value: string | undefined | null): DietPreference => {
  const diet = (value || "").toLowerCase().trim();
  if (diet === "veg" || diet === "vegetarian") return "veg";
  if (diet === "eggtarian" || diet === "eggitarian") return "eggtarian";
  if (diet === "non-veg" || diet === "nonveg" || diet === "non vegetarian") return "non-veg";
  return "none";
};

/**
 * Spice packets and preserved goods named after the meat or fish they season.
 * The shared list — the same phrases the shelf-life table and the category
 * inferrer consult, so "Chicken Masala" cannot be a spice packet to one
 * subsystem and Non-Veg to another.
 *
 * Scope of what this changes, stated plainly because it moves a safety check
 * in the permissive direction: an item whose NAME is one of these phrases is
 * no longer read as meat. The backstop is `resolveItemDiet`, which reads the
 * ingredient text too and takes the stricter answer — so a scanned ready-meal
 * declaring chicken is still caught. A hand-typed item with no ingredient text
 * is not. That trade is deliberate and reviewed; see the tests.
 */
const MEAT_FALSE_FRIENDS = FALSE_FRIENDS.meat;

export function getItemDietType(value: string): ItemDietType {
  const text = (value || "").toLowerCase();
  // Checked before the animal terms, so the packet wins over the word inside
  // its name — the same ordering EGG_FREE_CLAIMS uses below.
  const isSpicePacket = MEAT_FALSE_FRIENDS.some((p) => matchesTerm(text, p));
  if (!isSpicePacket && ANIMAL_TERMS.some((t) => hasWord(text, t))) return "non-veg";
  if (EGG_FREE_CLAIMS.some((c) => text.includes(c))) return "veg";
  if (!isSpicePacket && EGG_TERMS.some((t) => hasWord(text, t))) return "egg";
  return "veg";
}

/**
 * The stricter of the name reading and the ingredient reading.
 *
 * A pack whose name gives nothing away ("Maggi Masala", "Chef's Special")
 * can still declare chicken fat or egg powder in its ingredients. Reading
 * only the name lets that through. Where both are available the stricter
 * answer wins, because for a vegetarian a false "veg" is the expensive
 * mistake and a false "non-veg" is only an inconvenience.
 */
export function resolveItemDiet(name: string, ingredientsText?: string | null): ItemDietType {
  const fromName = getItemDietType(name);
  const fromIngredients = ingredientsText ? getItemDietType(ingredientsText) : "veg";
  if (fromName === "non-veg" || fromIngredients === "non-veg") return "non-veg";
  if (fromName === "egg" || fromIngredients === "egg") return "egg";
  return "veg";
}

/** True when this item is not allowed under the given preference. */
export function isDietConflict(userDiet: DietPreference, itemDiet: ItemDietType): boolean {
  if (userDiet === "none" || userDiet === "non-veg") return false;
  if (userDiet === "veg") return itemDiet !== "veg";
  // Eggtarian: egg is fine, meat and fish are not. This case did not exist
  // before — an eggtarian user adding chicken saw "Matches Diet".
  return itemDiet === "non-veg";
}

/** Short label for the chip on an item card. */
export function dietChipLabel(userDiet: DietPreference, itemDiet: ItemDietType): string {
  if (!isDietConflict(userDiet, itemDiet)) {
    return userDiet === "none" ? ITEM_DIET_LABEL[itemDiet] : "Matches Diet";
  }
  return itemDiet === "non-veg" ? "Not Vegetarian" : "Contains Egg";
}

export const ITEM_DIET_LABEL: Record<ItemDietType, string> = {
  veg: "Veg",
  egg: "Contains Egg",
  "non-veg": "Non-Veg",
};

export const DIET_PREFERENCE_LABEL: Record<DietPreference, string> = {
  veg: "Vegetarian",
  eggtarian: "Eggtarian",
  "non-veg": "Non-vegetarian",
  none: "No preference",
};
