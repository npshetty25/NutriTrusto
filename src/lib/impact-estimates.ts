import type { ItemCategory } from "@/lib/item-category";

// Rough, clearly-labeled averages for an Indian grocery basket (the app's
// FSSAI labels, receipt formats, and grocery brands are already
// India-focused) — not per-product prices. Good enough to give a
// directional "money saved / CO2 avoided" estimate, not a receipt.
interface ImpactEstimate {
  inrPerItem: number;
  co2KgPerItem: number;
}

const CATEGORY_IMPACT: Record<ItemCategory, ImpactEstimate> = {
  vegetable: { inrPerItem: 40, co2KgPerItem: 0.4 },
  fruit: { inrPerItem: 60, co2KgPerItem: 0.5 },
  dairy: { inrPerItem: 60, co2KgPerItem: 1.2 },
  meat: { inrPerItem: 220, co2KgPerItem: 3.5 },
  grain: { inrPerItem: 70, co2KgPerItem: 0.3 },
  beverage: { inrPerItem: 40, co2KgPerItem: 0.3 },
  bakery: { inrPerItem: 50, co2KgPerItem: 0.4 },
  frozen: { inrPerItem: 130, co2KgPerItem: 0.5 },
  snack: { inrPerItem: 40, co2KgPerItem: 0.4 },
  pantry: { inrPerItem: 60, co2KgPerItem: 0.3 },
  unknown: { inrPerItem: 50, co2KgPerItem: 0.4 },
};

export const getImpactEstimate = (category: ItemCategory): ImpactEstimate => CATEGORY_IMPACT[category];
