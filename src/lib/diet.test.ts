import { describe, it, expect } from "vitest";
import { getItemDietType, resolveItemDiet, hasWord } from "./diet";
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
