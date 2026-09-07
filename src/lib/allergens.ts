import { matchesTerm, FALSE_FRIENDS } from "@/lib/text-match";

export type AllergenTag = "nuts" | "dairy" | "gluten" | "soy" | "egg" | "shellfish" | "sesame";

/**
 * Terms that indicate an allergen, matched through the shared `matchesTerm`.
 *
 * This used a bare `text.includes(keyword)` — the fourth subsystem in this
 * codebase to reinvent that defect. Measured false positives before the fix:
 *
 *   coconut milk    -> dairy        soy-free formula -> soy
 *   eggplant        -> egg          cream of tartar  -> dairy
 *   shea butter     -> dairy        cocoa butter     -> dairy
 *   milk thistle    -> dairy        peanut butter    -> nuts + dairy
 *
 * `soy-free` is the worst of them: the matcher read a claim that the product
 * contains NO soy as evidence that it does.
 *
 * NOTE ON COMPLETENESS: this list is inherited, not audited. It has not been
 * reviewed against FSSAI's declared-allergen list or any regional naming, and
 * it carries no Indian names at all (no moongphali, no til, no kaju). It is
 * adequate for *disclosing* what a dish appears to contain. It is NOT adequate
 * to back a filter anyone relies on, and nothing in the UI may describe it as
 * one until that review has happened.
 */
export const ALLERGEN_KEYWORDS: Record<AllergenTag, string[]> = {
  nuts: ["peanut", "almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan", "tree nut", "macadamia"],
  dairy: ["milk", "cheese", "butter", "cream", "whey", "casein", "lactose", "yogurt", "yoghurt", "ghee", "curd"],
  gluten: ["wheat", "barley", "rye", "gluten", "malt", "semolina"],
  soy: ["soy", "soya", "soybean"],
  egg: ["egg", "albumen", "albumin"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "shellfish", "oyster", "clam"],
  sesame: ["sesame", "tahini"],
};

/**
 * Phrases that contain an allergen word but are not that allergen.
 *
 * The dairy set is largely the shared `FALSE_FRIENDS.dairy` — the same list
 * the shelf-life table and the category inferrer consult, so a product cannot
 * be a sealed shelf-stable carton to one subsystem and dairy to another. The
 * additions here are non-dairy products named "butter" or "cream" that the
 * other subsystems had no reason to enumerate.
 */
const ALLERGEN_EXCLUSIONS: Partial<Record<AllergenTag, string[]>> = {
  dairy: [
    ...FALSE_FRIENDS.dairy,
    "shea butter", "cocoa butter", "apple butter", "cream of tartar",
    "milk thistle", "coconut cream", "creamer",
  ],
  egg: ["eggplant", "eggless", "egg-free", "egg free"],
  nuts: ["nutmeg", "coconut", "water chestnut", "nutritional yeast"],
};

/**
 * Claims that a product is FREE of an allergen, which contain the allergen's
 * own name. Checked before the terms, so the claim wins — the same rule
 * `EGG_FREE_CLAIMS` applies in diet.ts.
 */
const FREE_FROM_CLAIMS: Record<AllergenTag, string[]> = {
  nuts: ["nut free", "nut-free", "peanut free", "peanut-free"],
  dairy: ["dairy free", "dairy-free", "milk free", "milk-free", "lactose free", "lactose-free"],
  gluten: ["gluten free", "gluten-free"],
  soy: ["soy free", "soy-free", "soya free", "soya-free"],
  egg: ["egg free", "egg-free", "eggless"],
  shellfish: ["shellfish free", "shellfish-free"],
  sesame: ["sesame free", "sesame-free"],
};

export const ALLERGEN_LABELS: Record<AllergenTag, string> = {
  nuts: "Nuts",
  dairy: "Dairy",
  gluten: "Gluten",
  soy: "Soy",
  egg: "Egg",
  shellfish: "Shellfish",
  sesame: "Sesame",
};

/**
 * Allergens a text appears to contain.
 *
 * Safe to run over free prose as well as label text now that it matches on
 * word boundaries and consults exclusions — it previously only ever saw
 * structured ingredient lists from a barcode scan.
 *
 * An empty array means "nothing matched", never "safe". The caller
 * distinguishes that from "no ingredient data at all", which is why the card
 * badge can say unknown rather than implying a clean result.
 */
export const detectAllergens = (ingredientsText: string): AllergenTag[] => {
  const text = (ingredientsText || "").toLowerCase();
  return (Object.keys(ALLERGEN_KEYWORDS) as AllergenTag[]).filter((tag) => {
    if (FREE_FROM_CLAIMS[tag].some((claim) => text.includes(claim))) return false;
    const exclusions = ALLERGEN_EXCLUSIONS[tag] ?? [];
    return ALLERGEN_KEYWORDS[tag].some((term) => {
      if (!matchesTerm(text, term)) return false;
      // The term matched — but only counts if it is not part of an excluded
      // phrase sitting at that spot ("butter" inside "peanut butter").
      return !exclusions.some((phrase) => matchesTerm(text, phrase) && phrase.includes(term));
    });
  });
};
