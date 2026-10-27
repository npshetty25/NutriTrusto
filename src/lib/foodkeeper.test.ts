import { describe, expect, it } from "vitest";
import { findFoodKeeperEntry, foodKeeperLabel, openedDaysFor } from "./foodkeeper";
import { estimateShelfLife } from "./shelf-life";

const label = (name: string) => {
  const hit = findFoodKeeperEntry(name);
  return hit ? foodKeeperLabel(hit.entry) : null;
};

describe("FoodKeeper matching", () => {
  it("matches items our own table does not know", () => {
    for (const name of ["Quinoa", "Tofu", "Tahini", "Kimchi", "Chia Seeds", "Kiwi Fruit"]) {
      const est = estimateShelfLife(name);
      expect(est.source, name).toBe("known");
      expect(est.citation, name).toMatch(/FoodKeeper/);
    }
  });

  it("accepts a singular for USDA's plural name", () => {
    expect(label("Avocado")).toBe("avocados");
  });

  it("knows Indian names for the same USDA products", () => {
    expect(label("Green Chillies")).toBe("hot peppers");
    expect(label("Hari Mirch")).toBe("hot peppers");
    expect(label("Kellogg's Corn Flakes")).toBe("cereal (ready-to-eat)");
    expect(label("Soya Chunks")).toBe("textured soy protein ((TSP))");
  });

  it("does not give dried red chillies or chilli products a fresh chilli's days", () => {
    for (const name of ["Lal Mirchi", "Kashmiri Mirchi", "Red Chilli Powder", "Green Chilli Sauce", "Mirchi Pickle"]) {
      expect(label(name), name).not.toBe("hot peppers");
    }
  });

  it("never matches through a loose keyword", () => {
    // Eggplant lists "egg" as a keyword; an egg is not an eggplant.
    expect(label("Eggs")).not.toBe("eggplant");
    expect(label("Half and half")).toBeNull();
  });

  it("prefers the raw product over a cooked or homemade one", () => {
    expect(label("Quinoa")).toBe("quinoa (uncooked)");
    expect(estimateShelfLife("Quinoa").days).toBeGreaterThan(300);
  });

  it("uses a qualifier to tell variants apart", () => {
    expect(label("Cheese Slices")).toBe("cheese (processed slices)");
  });

  it("does not give a frozen product's figure to a fresh one", () => {
    expect(label("Bagel")).toBe("bagel (fresh baked)");
    expect(findFoodKeeperEntry("Pizza")).toBeNull();
    expect(findFoodKeeperEntry("Ice Cream")?.storage).toBe("freezer");
  });

  it("does not give a prepared dish the dry ingredient's figure", () => {
    expect(findFoodKeeperEntry("Fried Rice")).toBeNull();
  });

  it("does not match a word that only describes another food", () => {
    // "almond" modifies "milkshake"; the item is not almonds.
    expect(findFoodKeeperEntry("Almond Milkshake")).toBeNull();
    // Garlic bread is bread, not garlic.
    expect(label("Garlic Bread")).not.toMatch(/^garlic/);
    // A trailing word from the entry's own description is fine.
    expect(label("Cheese Slices")).toBe("cheese (processed slices)");
  });

  it("converts perishable figures to Indian storage, rounding down", () => {
    // USDA: strawberries 2 days in a 4 °C fridge. At 7 °C that is less.
    const hit = findFoodKeeperEntry("Strawberries");
    expect(hit?.storage).toBe("fridge");
    expect(hit?.adjusted).toBe(true);
    expect(hit?.days).toBeLessThan(2);
    expect(hit?.days).toBeGreaterThanOrEqual(1);
  });

  it("does not temperature-convert rancidity-limited goods", () => {
    // USDA gives walnuts 2–4 weeks; the microbial model would cut that to days.
    const hit = findFoodKeeperEntry("Walnuts");
    expect(hit?.adjusted).toBe(false);
    expect(hit?.days).toBe(14);
  });

  it("our own Indian-storage table still wins where it has a row", () => {
    expect(estimateShelfLife("Mushrooms").citation).not.toMatch(/FoodKeeper/);
  });
});

describe("openedDaysFor", () => {
  it("gives USDA's after-opening figure, converted", () => {
    const tahini = openedDaysFor("Tahini", "fridge");
    expect(tahini?.days).toBe(21);
    expect(tahini?.citation).toMatch(/FoodKeeper/);
  });

  it("is null where USDA gives none, or for the freezer", () => {
    expect(openedDaysFor("Quinoa", "fridge")).toBeNull();
    expect(openedDaysFor("Tahini", "freezer")).toBeNull();
    expect(openedDaysFor("Something unknown", "fridge")).toBeNull();
  });
});
