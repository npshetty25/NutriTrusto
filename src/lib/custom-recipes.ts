import { getItemDietType, isDietConflict, type DietPreference, type ItemDietType } from "@/lib/diet";

/**
 * Your own recipes, saved to your account, with favourites.
 *
 * The diet is read from the ingredients you type, with the same classifier
 * the pantry and the built-in dishes use, so a recipe you write with chicken
 * in it is marked non-veg and hidden from a vegetarian account, exactly like
 * a pantry item would be. The person writing the recipe is told that when
 * they save it.
 */

export interface CustomRecipe {
  id: string;
  name: string;
  ingredients: string[];
  steps: string[];
  isFavourite: boolean;
  createdAt: string;
}

export const CUSTOM_RECIPE_LIMITS = { name: 80, ingredients: 60, steps: 40, lineLength: 300 } as const;

/** Splits a textarea into its non-empty lines, trimmed. */
export function linesFrom(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export type CustomRecipeDraft = { ok: true; value: Omit<CustomRecipe, "id" | "isFavourite" | "createdAt"> }
  | { ok: false; error: string };

/** Checks what the form typed. The same limits are enforced by the database. */
export function validateCustomRecipe(input: { name: string; ingredients: string; steps: string }): CustomRecipeDraft {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Give the recipe a name." };
  if (name.length > CUSTOM_RECIPE_LIMITS.name) {
    return { ok: false, error: `Keep the name under ${CUSTOM_RECIPE_LIMITS.name} characters.` };
  }

  const ingredients = linesFrom(input.ingredients);
  if (ingredients.length === 0) return { ok: false, error: "Add at least one ingredient, one per line." };
  if (ingredients.length > CUSTOM_RECIPE_LIMITS.ingredients) {
    return { ok: false, error: `Up to ${CUSTOM_RECIPE_LIMITS.ingredients} ingredients.` };
  }

  const steps = linesFrom(input.steps);
  if (steps.length === 0) return { ok: false, error: "Add at least one step, one per line." };
  if (steps.length > CUSTOM_RECIPE_LIMITS.steps) {
    return { ok: false, error: `Up to ${CUSTOM_RECIPE_LIMITS.steps} steps.` };
  }

  const longest = [...ingredients, ...steps].find((l) => l.length > CUSTOM_RECIPE_LIMITS.lineLength);
  if (longest !== undefined) {
    return { ok: false, error: `Keep each line under ${CUSTOM_RECIPE_LIMITS.lineLength} characters.` };
  }

  return { ok: true, value: { name, ingredients, steps } };
}

/** The diet a recipe's own ingredient list gives it. */
export function customRecipeDiet(ingredients: string[]): ItemDietType {
  return getItemDietType(ingredients.join(", "));
}

/** Whether an account's diet lets this recipe appear in its list. */
export function customRecipeAllowed(userDiet: DietPreference, ingredients: string[]): boolean {
  return !isDietConflict(userDiet, customRecipeDiet(ingredients));
}

/** The short sentence shown on save, when the recipe would be hidden. */
export function dietWarning(userDiet: DietPreference, ingredients: string[]): string | null {
  if (customRecipeAllowed(userDiet, ingredients)) return null;
  const diet = customRecipeDiet(ingredients);
  const why = diet === "non-veg" ? "meat or fish" : "egg";
  const list = userDiet === "veg" ? "vegetarian" : "eggtarian";
  return `This recipe contains ${why}, so it will be hidden from your ${list} list. It is still saved.`;
}

/** Turns a database row into the shape the page uses. */
export function rowToCustomRecipe(row: {
  id: string;
  name: string;
  ingredients: string[] | null;
  steps: string[] | null;
  is_favourite: boolean | null;
  created_at: string;
}): CustomRecipe {
  return {
    id: row.id,
    name: row.name,
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    isFavourite: !!row.is_favourite,
    createdAt: row.created_at,
  };
}
