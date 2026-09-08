import { describe, it, expect } from "vitest";
import { detectAllergens, ALLERGEN_KEYWORDS, ALLERGEN_LABELS, type AllergenTag } from "./allergens";

/**
 * These tests cover the MATCHER, not the completeness of the term list.
 * The list is inherited and unaudited — see the note in allergens.ts. A green
 * suite here means "the terms we have are matched correctly", never "every
 * allergen is caught".
 */

describe("detectAllergens — false friends that previously fired", () => {
  it.each([
    ["coconut milk, sugar", "dairy"],
    ["cream of tartar", "dairy"],
    ["shea butter", "dairy"],
    ["cocoa butter", "dairy"],
    ["milk thistle extract", "dairy"],
    ["peanut butter", "dairy"],
    ["eggplant, oil", "egg"],
    ["nutmeg", "nuts"],
  ] as [string, AllergenTag][])("%s must not be flagged %s", (text, tag) => {
    expect(detectAllergens(text)).not.toContain(tag);
  });

  it("peanut butter is still nuts", () => {
    expect(detectAllergens("peanut butter")).toContain("nuts");
  });
});

describe("detectAllergens — dairy products are dairy, whatever their shelf life", () => {
  // A regression I caused and then found: ALLERGEN_EXCLUSIONS was seeded from
  // FALSE_FRIENDS.dairy. The two lists look interchangeable and answer
  // opposite questions — that one asks "is this fresh perishable dairy?"
  // (Milk Powder is not, correctly, it keeps a year), this one asks "does
  // this contain milk protein?" (Milk Powder emphatically does). Sharing them
  // made the badge report NO DAIRY for nine real dairy products.
  it.each([
    "Milk Powder", "Condensed Milk", "Milk Chocolate", "Ice Cream",
    "Cream Biscuit", "Butter Paneer", "Curd Rice", "Whole Milk",
  ])("%s is dairy", (name) => {
    expect(detectAllergens(name)).toContain("dairy");
  });

  it("keeps the genuine non-dairy exclusions", () => {
    for (const name of [
      "Coconut Milk", "Oat Milk", "Shea Butter", "Cocoa Butter",
      "Cream of Tartar", "Milk Thistle",
    ]) {
      expect(detectAllergens(name), name).not.toContain("dairy");
    }
  });
});

describe("detectAllergens — a free-from claim is not evidence of the allergen", () => {
  // The worst of the old failures: the matcher read a claim that a product
  // contains NO soy as proof that it does.
  it.each([
    ["soy-free formula", "soy"],
    ["gluten-free oats", "gluten"],
    ["dairy free spread", "dairy"],
    ["eggless cake", "egg"],
    ["nut-free granola", "nuts"],
  ] as [string, AllergenTag][])("%s must not be flagged %s", (text, tag) => {
    expect(detectAllergens(text)).not.toContain(tag);
  });
});

describe("detectAllergens — real allergens are still caught", () => {
  it.each([
    ["whole milk, butter, cheese", "dairy"],
    ["paneer, curd, ghee", "dairy"],
    ["contains almonds and cashews", "nuts"],
    ["wheat flour, semolina", "gluten"],
    ["prawns, oysters", "shellfish"],
    ["eggs, albumen", "egg"],
    ["sesame seeds, tahini", "sesame"],
    ["soya chunks", "soy"],
  ] as [string, AllergenTag][])("%s is flagged %s", (text, tag) => {
    expect(detectAllergens(text)).toContain(tag);
  });

  it("catches plurals without a second entry per term", () => {
    expect(detectAllergens("walnuts")).toContain("nuts");
    expect(detectAllergens("crabs")).toContain("shellfish");
  });
});

describe("detectAllergens — shape", () => {
  it("returns [] for empty or absent text rather than throwing", () => {
    expect(detectAllergens("")).toEqual([]);
    expect(detectAllergens(undefined as unknown as string)).toEqual([]);
  });

  it("every tag has a label and at least one term", () => {
    for (const tag of Object.keys(ALLERGEN_KEYWORDS) as AllergenTag[]) {
      expect(ALLERGEN_LABELS[tag]).toBeTruthy();
      expect(ALLERGEN_KEYWORDS[tag].length).toBeGreaterThan(0);
    }
  });
});
