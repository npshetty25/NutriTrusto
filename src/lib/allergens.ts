import { matchesTerm } from "@/lib/text-match";

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
 * Phrases that contain an allergen word but do not contain that allergen.
 *
 * This list must NOT be `FALSE_FRIENDS.dairy`, and briefly was — a mistake
 * worth recording, because the two lists look interchangeable and are not.
 * They answer opposite questions:
 *
 *   FALSE_FRIENDS.dairy asks IDENTITY — "is this a fresh perishable dairy
 *     product?" Milk Powder is not, so it is excluded there, correctly: it
 *     keeps for a year on a shelf.
 *   This list asks COMPOSITION — "does this contain milk protein?" Milk
 *     Powder emphatically does.
 *
 * Sharing the list made the allergen badge report NO DAIRY for Milk Powder,
 * Condensed Milk, Milkmaid, Milk Chocolate, Ice Cream, Cream Biscuit, Butter
 * Paneer, Curd Rice and Milkshake. Every one of those is dairy, and a miss in
 * an allergen badge is the direction that hurts someone.
 *
 * So this list is its own, and the bar for an entry is strict: the allergen
 * word appears in the name AND the product genuinely does not contain the
 * allergen. Anything that merely *keeps differently* belongs in the other
 * list, not this one.
 */
const ALLERGEN_EXCLUSIONS: Partial<Record<AllergenTag, string[]>> = {
  dairy: [
    // Plant milks — the word "milk", none of the protein.
    "coconut milk", "soy milk", "soya milk", "almond milk", "oat milk",
    "rice milk", "cashew milk", "coconut cream",
    // Named "butter" or "cream", not dairy.
    "peanut butter", "shea butter", "cocoa butter", "apple butter",
    "cream of tartar",
    // A plant.
    "milk thistle",
    // NOT excluded, deliberately: milk powder, condensed milk, milkmaid,
    // milk chocolate, ice cream, cream biscuit, butter chicken, butter
    // paneer, curd rice, milkshake, khoya — all dairy. And not "creamer":
    // powdered coffee creamer commonly contains sodium caseinate.
  ],
  egg: ["eggplant", "eggless", "egg-free", "egg free"],
  nuts: ["nutmeg", "water chestnut", "nutritional yeast", "nut-free", "nut free"],
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
