import { describe, expect, it } from "vitest";
import { LOCAL_RECIPES, findLocalRecipe, localRecipeDetail, localRecipeDiet, localRecipeId } from "./global-recipes";

const FIFTEEN = [
  "Italy", "Greece", "Peru", "Portugal", "Spain", "Japan", "Turkey", "China",
  "France", "Indonesia", "Mexico", "Serbia", "India", "Poland", "United States",
];

const all = Object.values(LOCAL_RECIPES).flat();

describe("built-in cuisines", () => {
  it("covers exactly the 15 countries in the ranking, and no others", () => {
    expect(Object.keys(LOCAL_RECIPES).sort()).toEqual([...FIFTEEN].sort());
  });

  it("gives every country at least five dishes", () => {
    for (const country of FIFTEEN) {
      expect(LOCAL_RECIPES[country].length, country).toBeGreaterThanOrEqual(5);
    }
  });

  it("offers every country at least one vegetarian dish, so the veg filter is never empty", () => {
    for (const country of FIFTEEN) {
      const veg = LOCAL_RECIPES[country].filter((r) => localRecipeDiet(r) === "veg");
      expect(veg.length, country).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives every country a dish that is not vegetarian, so the all filter adds something", () => {
    for (const country of FIFTEEN) {
      const other = LOCAL_RECIPES[country].filter((r) => localRecipeDiet(r) !== "veg");
      expect(other.length, country).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("built-in dishes are complete and unique", () => {
  it("has unique ids across every cuisine", () => {
    const ids = all.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives each dish at least three ingredients and two steps", () => {
    for (const r of all) {
      expect(r.ingredients.length, r.name).toBeGreaterThanOrEqual(3);
      expect(r.steps.length, r.name).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives every dish a name that does not repeat its own ingredient list", () => {
    for (const r of all) expect(r.name.length, r.name).toBeLessThan(60);
  });
});

describe("the diet is read from the ingredients", () => {
  it("labels a dish with chicken as non-veg, and a dish with only vegetables as veg", () => {
    const katsu = findLocalRecipe("local-japan-katsu")!.recipe;
    const dal = findLocalRecipe("local-india-dal-tadka")!.recipe;
    expect(localRecipeDiet(katsu)).toBe("non-veg");
    expect(localRecipeDiet(dal)).toBe("veg");
  });

  it("labels an egg dish as egg, not veg", () => {
    expect(localRecipeDiet(findLocalRecipe("local-india-egg-bhurji")!.recipe)).toBe("egg");
  });

  it("does not call aubergine or kidney beans meat or egg", () => {
    expect(localRecipeDiet(findLocalRecipe("local-turkey-imam-bayildi")!.recipe)).toBe("veg");
    expect(localRecipeDiet(findLocalRecipe("local-us-texas-chili")!.recipe)).toBe("non-veg");
  });
});

describe("findLocalRecipe and the detail shape", () => {
  it("finds a dish by the id the recipes page uses", () => {
    const recipe = LOCAL_RECIPES.Peru[0];
    expect(findLocalRecipe(localRecipeId(recipe))?.country).toBe("Peru");
    expect(findLocalRecipe("52772")).toBeNull();
  });

  it("returns ingredients and steps in the TheMealDB shape the page already renders", () => {
    const recipe = LOCAL_RECIPES.Italy[0];
    const detail = localRecipeDetail("Italy", recipe);
    expect(detail.strMeal).toBe(recipe.name);
    expect(detail.strIngredient1).toBe(recipe.ingredients[0]);
    expect(detail[`strIngredient${recipe.ingredients.length + 1}`]).toBeUndefined();
    expect(detail.strInstructions).toContain(recipe.steps[0]);
  });
});
