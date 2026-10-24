import { describe, expect, it } from "vitest";
import { DISH_CATALOG, dishDiet, findDish, missingCoreIngredients, selectDishCandidates } from "./dish-catalog";

describe("the known-dish list", () => {
  it("has unique names, and every dish has at least one defining ingredient", () => {
    const names = DISH_CATALOG.map((d) => d.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const d of DISH_CATALOG) expect(d.core.length, d.name).toBeGreaterThan(0);
  });

  it("reads each dish's diet from its own ingredients", () => {
    expect(dishDiet(findDish("Palak Paneer")!)).toBe("veg");
    expect(dishDiet(findDish("Egg Curry")!)).toBe("egg");
    expect(dishDiet(findDish("Chicken Curry")!)).toBe("non-veg");
    expect(dishDiet(findDish("Baingan Bharta")!)).toBe("veg"); // eggplant is not egg
  });
});

describe("selectDishCandidates", () => {
  const pantry = [
    { name: "Palak (Spinach)", daysLeft: 1 },
    { name: "Paneer", daysLeft: 2 },
    { name: "Potatoes", daysLeft: 20 },
    { name: "Eggs", daysLeft: 5 },
  ];

  it("ranks the dish that uses the most urgent food first", () => {
    expect(selectDishCandidates(pantry, "veg")[0].name).toBe("Palak Paneer");
  });

  it("only offers dishes that fit the diet", () => {
    const veg = selectDishCandidates(pantry, "veg").map((c) => c.name);
    expect(veg).not.toContain("Egg Bhurji");
    const egg = selectDishCandidates(pantry, "eggtarian").map((c) => c.name);
    expect(egg).toContain("Egg Bhurji");
  });

  it("needs a pantry item to be a defining ingredient, not just an extra", () => {
    // Onion is an extra for many dishes and a staple, so alone it proposes nothing.
    expect(selectDishCandidates([{ name: "Onion", daysLeft: 1 }], "veg")).toEqual([]);
  });

  it("skips dishes already shown", () => {
    const names = selectDishCandidates(pantry, "veg", ["Palak Paneer"]).map((c) => c.name);
    expect(names).not.toContain("Palak Paneer");
  });

  it("lists which pantry items each dish would use", () => {
    const palak = selectDishCandidates(pantry, "veg").find((c) => c.name === "Palak Paneer")!;
    expect(palak.uses).toEqual(["Palak (Spinach)", "Paneer"]);
  });
});

describe("missingCoreIngredients", () => {
  it("finds a defining ingredient the recipe left out", () => {
    expect(missingCoreIngredients(findDish("Palak Paneer")!, ["Paneer", "salt"])).toEqual(["spinach"]);
  });

  it("accepts the Hindi name for an ingredient", () => {
    expect(missingCoreIngredients(findDish("Palak Paneer")!, ["Paneer", "1 bunch palak"])).toEqual([]);
  });
});
