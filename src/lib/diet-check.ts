import { ANIMAL_TERMS, EGG_TERMS, hasWord, type DietPreference } from "@/lib/diet";

/**
 * Server-side check that a generated recipe actually respects the user's
 * dietary preference.
 *
 * The prompt already forbids it, but a prompt is a request, not a guarantee,
 * and serving a vegetarian a chicken dish is the kind of failure this
 * product cannot make. Anything failing this check is regenerated, and if it
 * fails twice the request errors rather than shipping the violation.
 *
 * The term lists come from lib/diet.ts rather than a second copy here. They
 * were duplicated, and drifted: this file was missing 16 fish terms
 * (haddock, cod, tilapia, basa, hilsa, rohu, …) and every egg-dish term
 * (omelette, frittata, quiche) that the item classifier had gained. A model
 * could have returned a haddock curry or a bread omelette to a vegetarian
 * and this check would have waved it through.
 */

export type { DietPreference } from "@/lib/diet";
export { normalizeDietPreference as normalizeDiet } from "@/lib/diet";

/**
 * Returns the offending terms found, or [] when the text is acceptable for
 * the given preference. Word boundaries throughout, so "hamper" does not
 * trip "ham" and "eggplant" does not trip "egg".
 */
export function findDietViolations(text: string, preference: DietPreference): string[] {
  if (preference === "none" || preference === "non-veg") return [];

  const haystack = (text || "").toLowerCase();
  const banned = preference === "veg" ? [...ANIMAL_TERMS, ...EGG_TERMS] : ANIMAL_TERMS;

  return banned.filter((term) => hasWord(haystack, term));
}
