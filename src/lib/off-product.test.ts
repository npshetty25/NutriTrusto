import { describe, expect, it } from "vitest";
import { offProductName, ownLanguageNameFields, suggestNameFromCategories } from "./off-product";

describe("offProductName", () => {
  it("prefers product_name", () => {
    expect(offProductName({ product_name: "Aloo Bhujia", generic_name: "Snack" })).toBe("Aloo Bhujia");
  });

  it("falls back through the English, Indian and generic fields", () => {
    expect(offProductName({ product_name: "", product_name_en: "Masala Oats" })).toBe("Masala Oats");
    expect(offProductName({ abbreviated_product_name: "Parle-G" })).toBe("Parle-G");
    expect(offProductName({ generic_name: "Toned milk" })).toBe("Toned milk");
  });

  it("uses the product's own-language name when that is all there is", () => {
    expect(offProductName({ lc: "hi", product_name_hi: "आलू भुजिया" })).toBe("आलू भुजिया");
  });

  it("is empty, never 'Unknown Product', when there is no name", () => {
    expect(offProductName({ ingredients_text: "Potato, besan, oil" })).toBe("");
    expect(offProductName(null)).toBe("");
  });

  it("collapses whitespace", () => {
    expect(offProductName({ product_name: "  Amul   Butter " })).toBe("Amul Butter");
  });
});

describe("ownLanguageNameFields", () => {
  it("only accepts a two-letter language code", () => {
    expect(ownLanguageNameFields("mr")).toEqual(["product_name_mr", "generic_name_mr"]);
    expect(ownLanguageNameFields("xx,evil")).toEqual([]);
    expect(ownLanguageNameFields(undefined)).toEqual([]);
  });
});

describe("suggestNameFromCategories", () => {
  it("suggests the most specific English category", () => {
    expect(suggestNameFromCategories("Foods, Pastas, Noodles, Instant noodles")).toBe("Instant noodles");
    expect(suggestNameFromCategories("en:snacks, en:salty-snacks")).toBe("Salty snacks");
  });

  it("skips untranslated categories", () => {
    expect(suggestNameFromCategories("Snacks, hi:नमकीन")).toBe("Snacks");
  });

  it("suggests nothing when there are no categories", () => {
    expect(suggestNameFromCategories("")).toBe("");
    expect(suggestNameFromCategories(undefined)).toBe("");
  });
});
