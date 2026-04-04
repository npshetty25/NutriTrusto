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

export const inferItemCategory = (name: string): ItemCategory => {
  const value = name.toLowerCase();

  const orderedCategories: ItemCategory[] = [
    "vegetable",
    "fruit",
    "dairy",
    "meat",
    "grain",
    "beverage",
    "bakery",
    "frozen",
    "snack",
    "pantry",
  ];

  for (const category of orderedCategories) {
    if (categoryKeywords[category].some((keyword) => value.includes(keyword))) {
      return category;
    }
  }

  return "unknown";
};
