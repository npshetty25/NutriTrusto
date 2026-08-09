/**
 * Server-side check that a generated recipe actually respects the user's
 * dietary preference.
 *
 * The prompt already forbids it, but a prompt is a request, not a guarantee,
 * and serving a vegetarian user a chicken dish is the kind of failure this
 * product cannot make. Anything that fails this check is regenerated, and if
 * it fails twice the request errors rather than shipping the violation.
 */

export type DietPreference = "veg" | "eggtarian" | "non-veg" | "none";

// Deliberately unambiguous terms only. "broth" and "stock" are excluded
// because vegetable stock is vegetarian and flagging it would reject good
// recipes — this list is for things that cannot be anything but meat or fish.
const MEAT_AND_FISH = [
  "chicken", "mutton", "lamb", "beef", "pork", "bacon", "ham", "sausage",
  "salami", "pepperoni", "turkey", "duck", "goat", "veal", "venison",
  "fish", "salmon", "tuna", "anchovy", "sardine", "mackerel", "pomfret",
  "prawn", "shrimp", "crab", "lobster", "squid", "oyster", "clam", "mussel",
  "gelatin", "gelatine", "lard", "keema", "seekh",
];

const EGG = ["egg", "eggs", "anda", "albumen", "mayonnaise"];

export const normalizeDiet = (value: string | undefined | null): DietPreference => {
  const diet = (value || "").toLowerCase().trim();
  if (diet === "veg" || diet === "vegetarian") return "veg";
  if (diet === "eggtarian" || diet === "eggitarian") return "eggtarian";
  if (diet === "non-veg" || diet === "nonveg" || diet === "non vegetarian") return "non-veg";
  return "none";
};

/**
 * Returns the offending terms found, or [] when the text is acceptable for
 * the given preference. Matches on word boundaries so "hamper" doesn't trip
 * "ham" and "eggplant" doesn't trip "egg".
 */
export function findDietViolations(text: string, preference: DietPreference): string[] {
  if (preference === "none" || preference === "non-veg") return [];

  const haystack = text.toLowerCase();
  const banned = preference === "veg" ? [...MEAT_AND_FISH, ...EGG] : MEAT_AND_FISH;

  return banned.filter((term) => new RegExp(`\\b${term}\\b`, "i").test(haystack));
}
