import { describe, it, expect } from "vitest";
import { getItemDietType, resolveItemDiet, hasWord, isDietConflict, dietChipLabel } from "./diet";
import { findDietViolations } from "./diet-check";

/**
 * The vegetarian check is the one place in this app where being wrong means
 * serving a vegetarian a chicken dish. These tests exist because it was
 * silently failing on plurals: `\bprawn\b` does not match "Prawns", and
 * ANIMAL_TERMS spells out no plural forms at all.
 */

describe("hasWord accepts plurals", () => {
  it("matches the plural of a singular term", () => {
    expect(hasWord("prawns masala", "prawn")).toBe(true);
    expect(hasWord("fried sausages", "sausage")).toBe(true);
    expect(hasWord("anchovies", "anchovy" )).toBe(false); // irregular, see below
    expect(hasWord("sardines", "sardine")).toBe(true);
  });

  it("still refuses a longer word that merely starts with the term", () => {
    // The reason the plural rule was avoided for years. It does not apply:
    // matchesTerm extends by "s"/"es" only, never past another consonant.
    expect(hasWord("eggplant", "egg")).toBe(false);
    expect(hasWord("eggless cake", "egg")).toBe(false);
    expect(hasWord("hamper", "ham")).toBe(false);
    expect(hasWord("shrimpy", "shrimp")).toBe(false);
  });
});

describe("getItemDietType — plural item names", () => {
  // Every one of these was classified "veg" before hasWord accepted plurals.
  const nonVegPlurals = [
    "Prawns", "Shrimps", "Crabs", "Oysters", "Mussels", "Clams",
    "Sardines", "Sausages", "Chickens", "Squids", "Lobsters",
  ];

  for (const name of nonVegPlurals) {
    it(`classifies ${name} as non-veg`, () => {
      expect(getItemDietType(name)).toBe("non-veg");
    });
  }

  it("still classifies the singulars as non-veg", () => {
    for (const name of ["Prawn", "Shrimp", "Crab", "Sausage", "Chicken"]) {
      expect(getItemDietType(name)).toBe("non-veg");
    }
  });
});

describe("getItemDietType — vegetarian items stay vegetarian", () => {
  // A false "non-veg" on someone's dal trains them to ignore the mark, so
  // these matter as much as the misses above.
  const vegItems = [
    "Eggplant", "Brinjal", "Eggless Mayonnaise", "Paneer", "Tomatoes",
    "Potatoes", "Onions", "Soya Chunks", "Vegetable Stock", "Curd",
    "Peanut Butter", "Coconut Milk", "Rajma", "Palak", "Bhindi",
  ];

  for (const name of vegItems) {
    it(`classifies ${name} as veg`, () => {
      expect(getItemDietType(name)).toBe("veg");
    });
  }

  it("classifies egg items as egg, not non-veg", () => {
    expect(getItemDietType("Eggs")).toBe("egg");
    expect(getItemDietType("Egg")).toBe("egg");
  });
});

describe("spice packets are not meat — shared FALSE_FRIENDS", () => {
  // These are the same phrases the shelf-life table and the category inferrer
  // consult. Before this, an MDH packet was a spice mix to one subsystem and
  // Non-Veg to another.
  // These were asserted as "veg" one pass ago. That was resolving a genuine
  // ambiguity in the permissive direction: each name reads BOTH as a spice
  // packet (the phrase) and as meat (the word), and with no ingredient text
  // there is nothing to break the tie. Telling a vegetarian a ready-meal is
  // egg- and meat-free on the strength of a guess is not a mistake the app
  // gets to make, so the classifier declines instead.
  it.each([
    "Fish Curry Masala", "Chicken Masala", "Egg Curry Masala",
    "Butter Chicken Masala", "Fish Masala", "Chicken Curry Masala",
  ])("%s is uncertain, not veg", (name) => {
    expect(getItemDietType(name)).toBe("uncertain");
  });

  it("a spice-packet phrase with no animal word is still plainly veg", () => {
    // The exclusion alone does not make a name ambiguous — only the exclusion
    // AND an animal term together do.
    expect(getItemDietType("Eggplant")).toBe("veg");
    expect(getItemDietType("Peanut Butter")).toBe("veg");
    expect(getItemDietType("Paneer Masala")).toBe("veg");
  });

  it("ingredient text resolves the ambiguity in both directions", () => {
    expect(resolveItemDiet("Chicken Masala", "coriander, cumin, chilli")).toBe("veg");
    expect(resolveItemDiet("Chicken Masala", "chicken, tomato, spices")).toBe("non-veg");
    expect(resolveItemDiet("Egg Curry Masala", "egg powder, spices")).toBe("egg");
    // Nothing to resolve it with: the uncertainty survives rather than
    // collapsing to a guess.
    expect(resolveItemDiet("Chicken Masala", null)).toBe("uncertain");
    expect(resolveItemDiet("Chicken Masala", "")).toBe("uncertain");
  });

  it("uncertain is never reported as matching a diet", () => {
    expect(isDietConflict("veg", "uncertain")).toBe(false);
    expect(dietChipLabel("veg", "uncertain")).toBe("Check the label");
    expect(dietChipLabel("eggtarian", "uncertain")).toBe("Check the label");
    expect(dietChipLabel("none", "uncertain")).toBe("Check the label");
    expect(dietChipLabel("veg", "uncertain")).not.toMatch(/Matches Diet/);
  });

  // The permissive direction of the change above is bounded by these. The
  // dish is still meat; only the packet named after it is not.
  it.each([
    "Butter Chicken", "Chicken Curry", "Chicken Breast", "Fish Fillet",
    "Mutton Keema", "Prawns", "Chicken",
  ])("%s is still non-veg", (name) => {
    expect(getItemDietType(name)).toBe("non-veg");
  });

  it("the ingredient text remains the backstop for a real ready-meal", () => {
    // A pack named like a spice packet but declaring chicken is still caught,
    // because resolveItemDiet takes the stricter of name and ingredients.
    expect(resolveItemDiet("Chicken Masala", "chicken, tomato, spices")).toBe("non-veg");
    expect(resolveItemDiet("Chicken Masala", "coriander, cumin, chilli")).toBe("veg");
  });

  it("does not weaken the recipe gate", () => {
    // findDietViolations does not go through getItemDietType and must be
    // unaffected: a generated recipe naming chicken is still refused.
    expect(findDietViolations("Chicken Masala Curry", "veg")).toContain("chicken");
    expect(findDietViolations("Fish Curry Masala", "veg")).toContain("fish");
  });
});

describe("findDietViolations — the check that gates a generated recipe", () => {
  it("catches plural animal terms for a vegetarian", () => {
    // The failure this whole change exists for: each of these returned [].
    expect(findDietViolations("Prawns Masala with rice", "veg")).toContain("prawn");
    expect(findDietViolations("Goan Crabs Curry", "veg")).toContain("crab");
    expect(findDietViolations("Sausages and onions", "veg")).toContain("sausage");
  });

  it("catches plural animal terms for an eggtarian too", () => {
    expect(findDietViolations("Prawns Masala", "eggtarian")).toContain("prawn");
  });

  it("allows egg for an eggtarian but not for a vegetarian", () => {
    expect(findDietViolations("Anda Bhurji with eggs", "eggtarian")).toEqual([]);
    expect(findDietViolations("Anda Bhurji with eggs", "veg").length).toBeGreaterThan(0);
  });

  it("does not fire on vegetarian dishes", () => {
    for (const dish of [
      "Baingan Bharta", "Eggless chocolate cake", "Aloo Gobi with tomatoes",
      "Palak Paneer", "Rajma Chawal", "Vegetable Stock Khichdi",
    ]) {
      expect(findDietViolations(dish, "veg")).toEqual([]);
    }
  });

  it("returns nothing when there is no preference to enforce", () => {
    expect(findDietViolations("Chicken Curry", "none")).toEqual([]);
    expect(findDietViolations("Chicken Curry", "non-veg")).toEqual([]);
  });
});

describe("resolveItemDiet takes the stricter of name and ingredients", () => {
  it("flags a harmless-looking name whose ingredients are not", () => {
    expect(resolveItemDiet("Protein Bar", "whey, gelatin, prawns")).toBe("non-veg");
  });

  it("keeps a vegetarian item vegetarian", () => {
    expect(resolveItemDiet("Biscuits", "wheat flour, sugar, palm oil")).toBe("veg");
  });
});
