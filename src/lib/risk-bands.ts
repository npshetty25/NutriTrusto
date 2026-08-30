import type { PerishTier } from "@/lib/shelf-life-data";

/**
 * Risk bands (Deliverable 4).
 *
 * Replaces a single global rule — `≤4 days = critical, ≤13 = medium` —
 * applied identically to raw fish and to a sealed 365-day bag of basmati. It
 * was wrong at both ends: too slow for fish, and it turned a perfectly good
 * rice bag "Critical" for its last four days.
 *
 * Three rules, strictest wins:
 *
 *   ABSOLUTE FLOOR — a highly perishable item is critical at ≤1 day no
 *   matter what fraction that is. Ten percent of two days is meaningless,
 *   and being late is not symmetrical with being early.
 *
 *   RELATIVE — ≤10 % of the item's own shelf life left is critical, ≤25 % is
 *   "use soon". This is what makes one rule work for a 2-day fish and a
 *   365-day staple.
 *
 *   RELATIVE CEILING — the relative rule only applies within a sane number
 *   of days for the tier. Without it, rice with 30 days left is "critical"
 *   because 30/365 is 8 %, and the card would tell someone to eat a sealed
 *   bag of rice today. A percentage is not urgency on its own.
 *
 * This file is the single definition. `deriveRisk` in page.tsx and
 * `deriveRiskFromDays` in api/extract/route.ts were byte-identical copies of
 * the old rule — the same duplication that let the vegetarian check drift —
 * and both now call this.
 */

export type RiskLevel = "high" | "medium" | "low";

/** Critical at or below this many days, whatever the percentage says. */
const ABSOLUTE_CRITICAL_DAYS: Record<PerishTier, number> = {
  "highly-perishable": 1,
  perishable: 2,
  "semi-perishable": 3,
  "shelf-stable": 3,
};

/** "Use soon" at or below this many days, whatever the percentage says. */
const ABSOLUTE_SOON_DAYS: Record<PerishTier, number> = {
  "highly-perishable": 2,
  perishable: 4,
  "semi-perishable": 7,
  "shelf-stable": 14,
};

/**
 * The relative rule is ignored beyond this many days. Stops a long-life
 * staple being called critical while it still has weeks left.
 */
const RELATIVE_CEILING_DAYS: Record<PerishTier, number> = {
  "highly-perishable": 2,
  perishable: 4,
  "semi-perishable": 10,
  "shelf-stable": 21,
};

const CRITICAL_FRACTION = 0.1;
const SOON_FRACTION = 0.25;

export interface RiskInput {
  daysLeft: number;
  /** The item's full shelf life, for the relative band. */
  totalShelfLifeDays?: number;
  tier?: PerishTier;
}

export function deriveRiskLevel({ daysLeft, totalShelfLifeDays, tier = "perishable" }: RiskInput): RiskLevel {
  if (daysLeft <= 0) return "high";
  if (daysLeft <= ABSOLUTE_CRITICAL_DAYS[tier]) return "high";

  const ceiling = RELATIVE_CEILING_DAYS[tier];
  if (typeof totalShelfLifeDays === "number" && totalShelfLifeDays > 0) {
    const fraction = daysLeft / totalShelfLifeDays;
    if (fraction <= CRITICAL_FRACTION && daysLeft <= ceiling) return "high";
    if (fraction <= SOON_FRACTION && daysLeft <= ceiling * 2) return "medium";
  }

  if (daysLeft <= ABSOLUTE_SOON_DAYS[tier]) return "medium";
  return "low";
}

/**
 * Back-compatible shim for call sites that only have a day count.
 *
 * Without a shelf life or a tier this can only use the absolute floors, so
 * it behaves like a gentler version of the old global rule. Prefer
 * `deriveRiskLevel` with the full input wherever the shelf life is known.
 */
export function deriveRiskFromDaysOnly(daysLeft: number): RiskLevel {
  return deriveRiskLevel({ daysLeft, tier: "perishable" });
}

/**
 * What the card actually says.
 *
 * Deliberately derived from the DAY COUNT, not from the band. Once the bands
 * became relative the two stopped meaning the same thing: rice in its last
 * 8 % is banded high, and a chip reading "Eat today" on a sealed bag with a
 * month left would be plainly wrong. The band drives colour and sorting —
 * how urgent this is relative to its own life — while the label states the
 * literal deadline.
 */
export function riskLabelForDays(daysLeft: number): string {
  if (daysLeft <= 0) return "Past date";
  if (daysLeft === 1) return "Eat today";
  if (daysLeft <= 3) return "Eat in a day or two";
  if (daysLeft <= 7) return "Eat this week";
  if (daysLeft <= 30) return "Eat this month";
  return "Plenty of time";
}
