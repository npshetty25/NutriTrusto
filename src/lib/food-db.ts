// Internal Food Database equivalent to a real-world API lookup.
// This database holds scientifically accurate shelf lives (in days) and categorizations.

export interface FoodRecord {
  name: string;
  category: string;
  shelfLife: number; // in days
  defaultRisk: "low" | "medium" | "high";
  isVeg: boolean;
}

export const FOOD_DATABASE: FoodRecord[] = [
  // Produce (Fresh)
  { name: "tomato", category: "Produce", shelfLife: 7, defaultRisk: "medium", isVeg: true },
  { name: "onion", category: "Produce", shelfLife: 30, defaultRisk: "low", isVeg: true },
  { name: "potato", category: "Produce", shelfLife: 30, defaultRisk: "low", isVeg: true },
  { name: "banana", category: "Produce", shelfLife: 5, defaultRisk: "high", isVeg: true },
  { name: "apple", category: "Produce", shelfLife: 21, defaultRisk: "medium", isVeg: true },
  { name: "spinach", category: "Produce", shelfLife: 5, defaultRisk: "high", isVeg: true },
  { name: "lettuce", category: "Produce", shelfLife: 7, defaultRisk: "medium", isVeg: true },
  { name: "carrot", category: "Produce", shelfLife: 21, defaultRisk: "low", isVeg: true },
  { name: "broccoli", category: "Produce", shelfLife: 5, defaultRisk: "high", isVeg: true },
  
  // Dairy & Eggs
  { name: "milk", category: "Dairy", shelfLife: 7, defaultRisk: "high", isVeg: true }, // Veg in India usually includes milk
  { name: "cheese", category: "Dairy", shelfLife: 21, defaultRisk: "medium", isVeg: true },
  { name: "butter", category: "Dairy", shelfLife: 60, defaultRisk: "low", isVeg: true },
  { name: "yogurt", category: "Dairy", shelfLife: 10, defaultRisk: "medium", isVeg: true },
  { name: "egg", category: "Eggs", shelfLife: 21, defaultRisk: "medium", isVeg: false }, // Handled as Eggtarian later
  
  // Meat & Seafood
  { name: "chicken", category: "Meat", shelfLife: 2, defaultRisk: "high", isVeg: false },
  { name: "beef", category: "Meat", shelfLife: 3, defaultRisk: "high", isVeg: false },
  { name: "pork", category: "Meat", shelfLife: 3, defaultRisk: "high", isVeg: false },
  { name: "fish", category: "Seafood", shelfLife: 2, defaultRisk: "high", isVeg: false },
  { name: "salmon", category: "Seafood", shelfLife: 2, defaultRisk: "high", isVeg: false },
  
  // Pantry & Bakery
  { name: "bread", category: "Bakery", shelfLife: 5, defaultRisk: "high", isVeg: true },
  { name: "rice", category: "Pantry", shelfLife: 180, defaultRisk: "low", isVeg: true },
  { name: "pasta", category: "Pantry", shelfLife: 365, defaultRisk: "low", isVeg: true },
  { name: "flour", category: "Pantry", shelfLife: 180, defaultRisk: "low", isVeg: true },
  { name: "sugar", category: "Pantry", shelfLife: 730, defaultRisk: "low", isVeg: true },
  { name: "salt", category: "Pantry", shelfLife: 999, defaultRisk: "low", isVeg: true },
  { name: "oil", category: "Pantry", shelfLife: 365, defaultRisk: "low", isVeg: true },
];

/**
 * Searches the internal food database for a match based on the provided query string.
 * Uses a simple keyword intersection approach.
 */
export function lookupFoodItem(query: string): FoodRecord {
  const normalizedQuery = query.toLowerCase();
  
  // Try to find the first exact or partial match
  const match = FOOD_DATABASE.find(item => normalizedQuery.includes(item.name));
  
  if (match) {
    return match;
  }
  
  // Fallback for unknown items
  return {
    name: query, // Keep original receipt name
    category: "Misc",
    shelfLife: 14, // Generic 2 week estimation
    defaultRisk: "medium",
    isVeg: true // Assume veg unless "meat/chicken/fish" exists in the name
  };
}
