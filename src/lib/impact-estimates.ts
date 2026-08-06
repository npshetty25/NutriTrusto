import type { ItemCategory } from "@/lib/item-category";

// Rough, clearly-labeled averages — not per-product prices. Good enough to
// give a directional "money saved / CO2 avoided" estimate, not a receipt.
interface ImpactEstimate {
  usdPerItem: number;
  co2KgPerItem: number;
}

const CATEGORY_IMPACT: Record<ItemCategory, ImpactEstimate> = {
  vegetable: { usdPerItem: 2.0, co2KgPerItem: 0.4 },
  fruit: { usdPerItem: 2.5, co2KgPerItem: 0.5 },
  dairy: { usdPerItem: 3.0, co2KgPerItem: 1.2 },
  meat: { usdPerItem: 6.0, co2KgPerItem: 3.5 },
  grain: { usdPerItem: 2.0, co2KgPerItem: 0.3 },
  beverage: { usdPerItem: 2.5, co2KgPerItem: 0.3 },
  bakery: { usdPerItem: 2.5, co2KgPerItem: 0.4 },
  frozen: { usdPerItem: 3.0, co2KgPerItem: 0.5 },
  snack: { usdPerItem: 2.0, co2KgPerItem: 0.4 },
  pantry: { usdPerItem: 2.0, co2KgPerItem: 0.3 },
  unknown: { usdPerItem: 2.0, co2KgPerItem: 0.4 },
};

export const getImpactEstimate = (category: ItemCategory): ImpactEstimate => CATEGORY_IMPACT[category];
