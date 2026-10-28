import { selectDishCandidates } from "@/lib/dish-catalog";
import { dishesToAvoid, EMPTY_PROFILE, isJainConflict, type FoodProfile } from "@/lib/food-profile";

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
  /** A fasting day: nothing is planned for it. */
  fasting?: boolean;
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
export function planWeek(
  items: PlanItem[],
  dietaryPreference: string | undefined,
  days = 7,
  options: { profile?: FoodProfile; today?: Date } = {}
): PlannedMeal[] {
  const profile = options.profile ?? EMPTY_PROFILE;
  const start = options.today ?? new Date();
  // Past its date, or forbidden to this profile: not something the plan may build a dish around.
  let pool = items.filter((i) => i.daysPastEstimate === 0 && !(profile.jain && isJainConflict(i.name)));
  // Dishes this profile must never be offered are treated as already shown.
  const shown: string[] = dishesToAvoid(profile);
  const fasting = new Set(profile.fastingDays);
  const plan: PlannedMeal[] = [];

  for (let day = 0; day < days; day++) {
    if (fasting.has((start.getDay() + day) % 7)) {
      plan.push({ day, dish: "", uses: [], toBuy: [], fasting: true });
      continue;
    }
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
