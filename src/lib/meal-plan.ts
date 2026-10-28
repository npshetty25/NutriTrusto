import { selectDishCandidates } from "@/lib/dish-catalog";

export interface PlanItem {
  name: string;
  daysLeft: number;
  /** Beyond its date: never planned around, the same rule the recipe generator follows. */
  daysPastEstimate: number;
}

export interface PlannedMeal {
  /** 0 = today. */
  day: number;
  dish: string;
  uses: string[];
  toBuy: string[];
}

/**
 * A week of dinners from what is in the pantry, soonest-to-go first.
 *
 * Each day takes the best-scoring dish for what is left, then takes the items
 * it uses out of the pool, so the next day is built from different food. A
 * dish is never repeated. It stops early when the pantry cannot make anything
 * else, rather than padding the week with dishes that use nothing the person has.
 * Items that expire before their day come around are used on the days they last.
 */
export function planWeek(items: PlanItem[], dietaryPreference: string | undefined, days = 7): PlannedMeal[] {
  let pool = items.filter((i) => i.daysPastEstimate === 0);
  const shown: string[] = [];
  const plan: PlannedMeal[] = [];

  for (let day = 0; day < days; day++) {
    // An item that will be gone before this day cannot be planned for it.
    const fresh = pool.filter((i) => i.daysLeft >= day);
    const best = selectDishCandidates(fresh, dietaryPreference, shown, 1)[0];
    if (!best) break;
    plan.push({ day, dish: best.name, uses: best.uses, toBuy: best.toBuy });
    shown.push(best.name);
    const used = new Set(best.uses);
    pool = pool.filter((i) => !used.has(i.name));
  }
  return plan;
}

/** Everything the week needs bought, once each. */
export function shoppingForPlan(plan: PlannedMeal[]): string[] {
  return [...new Set(plan.flatMap((m) => m.toBuy))];
}
