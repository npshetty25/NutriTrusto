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
    // Cream is an extra in several dishes and defines none, so alone it proposes nothing.
    expect(selectDishCandidates([{ name: "Fresh Cream", daysLeft: 1 }], "veg")).toEqual([]);
  });

  it("has a dish for the everyday things people actually cook with", () => {
    // Measured before these dishes were added: every one of these alone got
    // "none of the dishes we know use these items".
    const cookable = [
      "Cucumber", "Bananas", "Raw Banana", "Mangoes", "Apples", "Papaya", "Pomegranate", "Coconut", "Lemons",
      "Coriander Leaves", "Onions", "Pav", "Bread", "Cheese Slices", "Tofu", "Soya Chunks", "Oats",
      "Maggi Noodles", "Frozen Corn", "Spring Onions", "Atta", "Cornflakes", "Buttermilk",
    ];
    for (const name of cookable) {
      expect(selectDishCandidates([{ name, daysLeft: 2 }], "veg").length, name).toBeGreaterThan(0);
    }
  });

  it("ranks a dish you can cook now above one that needs shopping", () => {
    const ranked = selectDishCandidates(
      [{ name: "Oats", daysLeft: 120 }, { name: "Maggi Noodles", daysLeft: 200 }, { name: "Carrots", daysLeft: 14 }],
      "veg",
      [],
      100
    );
    const oats = ranked.findIndex((c) => c.name === "Masala Oats");
    const gajarMatar = ranked.findIndex((c) => c.name === "Gajar Matar");
    expect(oats).toBeGreaterThanOrEqual(0);
    expect(gajarMatar === -1 || oats < gajarMatar).toBe(true);
    expect(ranked[oats].toBuy).toEqual([]);
    expect(ranked.find((c) => c.name === "Gajar Matar")?.toBuy).toEqual(["peas"]);
  });

  it("does not count basic staples as shopping", () => {
    const dal = selectDishCandidates([{ name: "Palak", daysLeft: 1 }], "veg").find((c) => c.name === "Dal Palak");
    expect(dal?.toBuy).toEqual([]);
  });

  it("does not turn a drink into a fruit chaat ingredient", () => {
    const names = selectDishCandidates([{ name: "Orange Juice", daysLeft: 2 }], "veg").map((c) => c.name);
    expect(names).not.toContain("Fruit Chaat");
  });

  it("keeps every new dish vegetarian unless its ingredients say otherwise", () => {
    for (const name of ["Fruit Chaat", "Pav Bhaji", "Cheese Sandwich", "Tofu Bhurji", "Masala Maggi", "Coconut Chutney"]) {
      expect(dishDiet(findDish(name)!), name).toBe("veg");
    }
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
