import { ALLERGEN_KEYWORDS, detectAllergens, type AllergenTag } from "@/lib/allergens";
import { DISH_CATALOG } from "@/lib/dish-catalog";
import { matchesTerm } from "@/lib/text-match";

/**
 * What this account does not eat, beyond veg / egg / non-veg: allergies, Jain
 * food, and days of fasting. Kept on the account (user_metadata.food_profile),
 * like the diet, so it needs no database change.
 *
 * It WARNS and steers, it does not hide: a pantry is shared, and an onion in it
 * is still an onion for someone else. The recipe route and the weekly plan do
 * keep these out of what they suggest.
 */
export interface FoodProfile {
  allergies: AllergenTag[];
  jain: boolean;
  /** Weekdays that are fasting days, 0 = Sunday ... 6 = Saturday. */
  fastingDays: number[];
}

export const EMPTY_PROFILE: FoodProfile = { allergies: [], jain: false, fastingDays: [] };

/**
 * Jain food leaves out onion, garlic and anything that grows underground, and
 * (by most households' practice) mushrooms. Each term is a whole word, matched
 * the way every other food term is.
 */
export const JAIN_AVOID = [
  "onion", "onions", "pyaz", "garlic", "lahsun", "potato", "potatoes", "aloo", "carrot", "carrots", "gajar",
  "radish", "mooli", "beetroot", "turnip", "shalgam", "ginger", "adrak", "sweet potato", "shakarkand", "yam", "suran",
  "mushroom", "mushrooms", "spring onion",
];

const ALL_TAGS = new Set(Object.keys(ALLERGEN_KEYWORDS));

/** Reads what was saved, ignoring anything that is not what we wrote. */
export function readProfile(metadata: unknown): FoodProfile {
  const raw = (metadata as { food_profile?: Partial<FoodProfile> } | null | undefined)?.food_profile;
  if (!raw || typeof raw !== "object") return EMPTY_PROFILE;
  return {
    allergies: Array.isArray(raw.allergies) ? raw.allergies.filter((t): t is AllergenTag => ALL_TAGS.has(t)) : [],
    jain: raw.jain === true,
    fastingDays: Array.isArray(raw.fastingDays)
      ? [...new Set(raw.fastingDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
      : [],
  };
}

export const isJainConflict = (text: string) => JAIN_AVOID.some((t) => matchesTerm(text.toLowerCase(), t));

/** What to flag on an item: its name, and its ingredients when a scan found them. */
export function profileWarnings(profile: FoodProfile, name: string, ingredientsText?: string | null): string[] {
  const out: string[] = [];
  if (profile.allergies.length > 0) {
    const found = detectAllergens(`${name}, ${ingredientsText ?? ""}`);
    const mine = new Set(profile.allergies);
    const hits = found.filter((t) => mine.has(t));
    if (hits.length > 0) out.push(`You avoid: ${hits.join(", ")}`);
  }
  if (profile.jain && isJainConflict(name)) out.push("Not Jain");
  return out;
}

/** Dishes in our catalogue this profile should not be offered, as titles for the dish selector's avoid list. */
export function dishesToAvoid(profile: FoodProfile): string[] {
  if (profile.allergies.length === 0 && !profile.jain) return [];
  const mine = new Set(profile.allergies);
  return DISH_CATALOG.filter((dish) => {
    const text = [...dish.core.flat(), ...dish.extras].join(", ");
    if (profile.jain && isJainConflict(text)) return true;
    return detectAllergens(text).some((t) => mine.has(t));
  }).map((d) => d.name);
}

/** What a generated recipe's ingredient lines break for this profile; empty means fine. */
export function recipeProblems(profile: FoodProfile, ingredientLines: string[]): string[] {
  const text = ingredientLines.join(", ");
  const problems: string[] = [];
  const mine = new Set(profile.allergies);
  for (const tag of detectAllergens(text)) if (mine.has(tag)) problems.push(tag);
  if (profile.jain && isJainConflict(text)) problems.push("a non-Jain ingredient (onion, garlic, potato or another root vegetable)");
  return problems;
}
