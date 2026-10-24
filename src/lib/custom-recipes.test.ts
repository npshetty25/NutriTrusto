import { describe, expect, it } from "vitest";
import {
  CUSTOM_RECIPE_LIMITS,
  customRecipeAllowed,
  customRecipeDiet,
  dietWarning,
  linesFrom,
  rowToCustomRecipe,
  validateCustomRecipe,
} from "./custom-recipes";

const good = { name: "Amma's dal", ingredients: "200 g toor dal\n1 onion", steps: "Pressure-cook the dal.\nFry the onion." };

describe("linesFrom", () => {
  it("drops blank lines and trims each line", () => {
    expect(linesFrom("  one \n\n two\r\n   \nthree ")).toEqual(["one", "two", "three"]);
  });
});

describe("validateCustomRecipe", () => {
  it("accepts a recipe with a name, an ingredient and a step", () => {
    const r = validateCustomRecipe(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("Amma's dal");
      expect(r.value.ingredients).toEqual(["200 g toor dal", "1 onion"]);
      expect(r.value.steps).toHaveLength(2);
    }
  });

  it("collapses spaces in the name", () => {
    const r = validateCustomRecipe({ ...good, name: "  Amma's   dal " });
    expect(r.ok && r.value.name).toBe("Amma's dal");
  });

  it("refuses a missing name, and a missing ingredient or step list", () => {
    expect(validateCustomRecipe({ ...good, name: "   " }).ok).toBe(false);
    expect(validateCustomRecipe({ ...good, ingredients: "\n  \n" }).ok).toBe(false);
    expect(validateCustomRecipe({ ...good, steps: "" }).ok).toBe(false);
  });

  it("enforces the same limits as the database", () => {
    expect(validateCustomRecipe({ ...good, name: "x".repeat(CUSTOM_RECIPE_LIMITS.name + 1) }).ok).toBe(false);
    const tooMany = Array.from({ length: CUSTOM_RECIPE_LIMITS.ingredients + 1 }, (_, i) => `item ${i}`).join("\n");
    expect(validateCustomRecipe({ ...good, ingredients: tooMany }).ok).toBe(false);
    const longLine = "x".repeat(CUSTOM_RECIPE_LIMITS.lineLength + 1);
    expect(validateCustomRecipe({ ...good, steps: longLine }).ok).toBe(false);
  });
});

describe("the diet is read from what was typed", () => {
  it("marks a recipe with chicken as non-veg and a plain dal as veg", () => {
    expect(customRecipeDiet(["500 g chicken thigh", "1 onion"])).toBe("non-veg");
    expect(customRecipeDiet(["200 g toor dal", "1 onion"])).toBe("veg");
  });

  it("hides an egg recipe from a vegetarian but not from an eggtarian", () => {
    const eggs = ["3 eggs", "1 onion"];
    expect(customRecipeAllowed("veg", eggs)).toBe(false);
    expect(customRecipeAllowed("eggtarian", eggs)).toBe(true);
  });

  it("shows everything to an account with no restriction", () => {
    expect(customRecipeAllowed("non-veg", ["chicken"])).toBe(true);
    expect(customRecipeAllowed("none", ["chicken"])).toBe(true);
  });

  it("explains why a recipe will be hidden, and says nothing when it will not", () => {
    expect(dietWarning("veg", ["500 g chicken"])).toMatch(/contains meat or fish|contains meat/);
    expect(dietWarning("veg", ["3 eggs"])).toMatch(/egg/);
    expect(dietWarning("eggtarian", ["500 g chicken"])).toMatch(/eggtarian list/);
    expect(dietWarning("veg", ["200 g dal"])).toBeNull();
  });
});

describe("rowToCustomRecipe", () => {
  it("maps a database row, and treats missing arrays as empty", () => {
    const r = rowToCustomRecipe({
      id: "1", name: "Dal", ingredients: null, steps: ["Cook."], is_favourite: true, created_at: "2026-10-24T00:00:00Z",
    });
    expect(r).toMatchObject({ id: "1", name: "Dal", ingredients: [], steps: ["Cook."], isFavourite: true });
  });
});
