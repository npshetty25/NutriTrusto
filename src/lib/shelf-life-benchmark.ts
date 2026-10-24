import { estimateShelfLife } from "@/lib/shelf-life";

/**
 * A fixed list of what an Indian household actually types or scans, used to
 * measure how much of a real pantry gets a SOURCED shelf-life figure rather
 * than a category average or a blind fallback.
 *
 * This measures coverage, not correctness: it says how often we have a source
 * for an item, not whether the source is right for this household. Correctness
 * per item is what the household-learning loop and the sourced citations are
 * for. Names are written the way people type them — brands, Hindi names,
 * plurals — because that is what the matcher has to cope with.
 */
export const BENCHMARK_ITEMS: string[] = [
  // Vegetables and fruit
  "Tomatoes", "Onions", "Potatoes", "Palak", "Methi", "Coriander Leaves", "Curry Leaves", "Green Chillies",
  "Ginger", "Garlic", "Lemons", "Carrots", "Cabbage", "Cauliflower", "Bhindi", "Brinjal", "Lauki", "Capsicum",
  "Cucumber", "Beetroot", "Mushrooms", "Green Peas", "French Beans", "Spring Onions", "Sweet Potato", "Pumpkin",
  "Drumsticks", "Raw Banana", "Bananas", "Apples", "Oranges", "Mangoes", "Papaya", "Grapes", "Pomegranate",
  "Watermelon", "Guava", "Chikoo", "Pineapple", "Coconut",
  // Dairy
  "Amul Taaza Milk", "Full Cream Milk", "Curd", "Dahi", "Paneer", "Amul Butter", "Ghee", "Cheese Slices",
  "Fresh Cream", "Buttermilk", "Lassi",
  // Bakery
  "Bread", "Brown Bread", "Pav", "Rusk", "Cake",
  // Protein
  "Eggs", "Chicken Breast", "Chicken Curry Cut", "Mutton", "Fish", "Prawns", "Tofu", "Soya Chunks",
  // Staples
  "Basmati Rice", "Toor Dal", "Moong Dal", "Chana Dal", "Masoor Dal", "Rajma", "Kabuli Chana", "Atta", "Maida",
  "Besan", "Rava", "Poha", "Sugar", "Salt", "Jaggery", "Tea", "Coffee", "Mustard Oil", "Sunflower Oil",
  // Packaged
  "Maggi Noodles", "Parle-G Biscuits", "Bournvita", "Mango Pickle", "Tomato Ketchup", "Jam", "Peanut Butter",
  "Cornflakes", "Oats", "Namkeen", "Potato Chips", "Instant Coffee",
  // Frozen
  "Frozen Peas", "Frozen Corn",
  // Sweets
  "Rasgulla", "Kaju Katli", "Gulab Jamun", "Besan Laddoo", "Soan Papdi", "Peda", "Jalebi",
  // Drinks
  "Coconut Water", "Orange Juice", "Soft Drink",
];

export type CoverageTier = "sourced" | "category" | "fallback";

export function coverageTier(name: string): CoverageTier {
  const e = estimateShelfLife(name);
  if (e.source === "known" || e.source === "database") return "sourced";
  if (e.source === "category") return "category";
  return "fallback";
}

export function measureCoverage(items: string[] = BENCHMARK_ITEMS) {
  const byTier: Record<CoverageTier, string[]> = { sourced: [], category: [], fallback: [] };
  for (const name of items) byTier[coverageTier(name)].push(name);
  const pct = (n: number) => Math.round((n / items.length) * 1000) / 10;
  return {
    total: items.length,
    sourced: pct(byTier.sourced.length),
    category: pct(byTier.category.length),
    fallback: pct(byTier.fallback.length),
    byTier,
  };
}
