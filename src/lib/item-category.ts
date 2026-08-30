import { matchesTerm, isExcluded, FALSE_FRIENDS } from "@/lib/text-match";

export type ItemCategory =
  | "vegetable"
  | "fruit"
  | "dairy"
  | "meat"
  | "grain"
  | "beverage"
  | "bakery"
  | "frozen"
  | "snack"
  | "pantry"
  | "unknown";

const categoryKeywords: Record<ItemCategory, string[]> = {
  vegetable: [
    "spinach", "tomato", "onion", "potato", "carrot", "broccoli", "cabbage", "capsicum", "pepper", "cucumber", "lettuce", "okra", "beans", "peas", "cauliflower"
  ],
  fruit: [
    "apple", "banana", "orange", "mango", "grape", "watermelon", "papaya", "pear", "pineapple", "berry", "kiwi", "avocado"
  ],
  dairy: [
    "milk", "cheese", "curd", "yogurt", "butter", "cream", "paneer", "ghee"
  ],
  meat: [
    "chicken", "meat", "beef", "pork", "fish", "salmon", "tuna", "egg", "mutton", "prawn", "shrimp", "crab", "bacon", "ham", "sausage", "turkey"
  ],
  grain: [
    "rice", "wheat", "flour", "oats", "quinoa", "pasta", "noodle", "lentil", "dal", "beans", "chickpea"
  ],
  beverage: [
    "juice", "drink", "coffee", "tea", "soda", "cola", "water", "shake"
  ],
  bakery: [
    "bread", "bun", "cake", "cookie", "biscuit", "croissant", "muffin"
  ],
  frozen: [
    "frozen", "ice cream", "french fries", "nuggets"
  ],
  snack: [
    "chips", "namkeen", "cracker", "snack", "chocolate", "candy"
  ],
  pantry: [
    "oil", "salt", "sugar", "spice", "masala", "sauce", "ketchup", "vinegar"
  ],
  unknown: [],
};

/**
 * Categories are tried in this order, so a more specific reading wins over a
 * broader one. Bakery is deliberately ahead of vegetable and dairy: "garlic
 * bread" is bread, and "cream bun" is a bun. Frozen is ahead of dairy for
 * the same reason — "ice cream" is frozen, not a dairy liquid.
 */
const orderedCategories: ItemCategory[] = [
  "frozen",
  "bakery",
  "snack",
  "beverage",
  "vegetable",
  "fruit",
  "dairy",
  "meat",
  "grain",
  "pantry",
];

/**
 * Infers a broad category from an item name.
 *
 * Used by the tier-4 shelf-life fallback and by the card's category icon.
 *
 * This used a bare `value.includes(keyword)` with no word boundaries and no
 * exclusions — the exact defect that was fixed in the tier-3 shelf-life
 * matcher and left in place here, so the fallback path still misread the
 * same seven products. Both matchers now share `matchesTerm` and the same
 * FALSE_FRIENDS phrases.
 */
export const inferItemCategory = (name: string): ItemCategory => {
  const value = (name || "").toLowerCase();
  if (!value.trim()) return "unknown";

  for (const category of orderedCategories) {
    // A phrase listed against this category is a product that merely
    // contains the word — "coconut milk" is not dairy.
    if (isExcluded(value, FALSE_FRIENDS[category])) continue;
    if (categoryKeywords[category].some((keyword) => matchesTerm(value, keyword))) {
      return category;
    }
  }

  return "unknown";
};
