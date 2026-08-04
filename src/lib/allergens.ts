export type AllergenTag = "nuts" | "dairy" | "gluten" | "soy" | "egg" | "shellfish" | "sesame";

const ALLERGEN_KEYWORDS: Record<AllergenTag, string[]> = {
  nuts: ["peanut", "almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan", "tree nut", "macadamia"],
  dairy: ["milk", "cheese", "butter", "cream", "whey", "casein", "lactose", "yogurt", "yoghurt", "ghee", "curd"],
  gluten: ["wheat", "barley", "rye", "gluten", "malt", "semolina"],
  soy: ["soy", "soya", "soybean"],
  egg: ["egg", "albumen", "albumin"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "shellfish", "oyster", "clam"],
  sesame: ["sesame", "tahini"],
};

export const ALLERGEN_LABELS: Record<AllergenTag, string> = {
  nuts: "Nuts",
  dairy: "Dairy",
  gluten: "Gluten",
  soy: "Soy",
  egg: "Egg",
  shellfish: "Shellfish",
  sesame: "Sesame",
};

export const detectAllergens = (ingredientsText: string): AllergenTag[] => {
  const text = ingredientsText.toLowerCase();
  return (Object.keys(ALLERGEN_KEYWORDS) as AllergenTag[]).filter((tag) =>
    ALLERGEN_KEYWORDS[tag].some((keyword) => text.includes(keyword))
  );
};
