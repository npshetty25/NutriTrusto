import { estimateShelfLife, findShelfLifeRow } from "@/lib/shelf-life";

/**
 * Learns, from this household's own history, where our estimate runs long.
 *
 * Every time an item is removed, item_outcomes records whether it was used or
 * thrown away, and how many days our estimate still gave it. An item thrown
 * away with days still left means the estimate was too generous for this
 * household — their coriander goes off sooner than the table says, say,
 * because their kitchen is warmer or they buy it already a day old.
 *
 * Deliberately one-directional and cautious:
 *   - it only ever SHORTENS an estimate, never lengthens one — a too-early
 *     warning costs a look, a too-late one costs the food;
 *   - it needs at least MIN_EVENTS such throw-aways of the same item before it
 *     says anything, so one forgotten bag does not change the numbers;
 *   - it never touches a date from the pack or one the person typed;
 *   - it says it did it, every time.
 */

export interface Outcome {
  name: string;
  outcome: "used" | "expired" | string;
  days_left_at_removal: number;
}

export const MIN_EVENTS = 3;

/** Groups name variants ("Palak (Spinach)", "Spinach") under one key. */
export function learningKey(name: string): string {
  return findShelfLifeRow(name)?.key ?? name.trim().toLowerCase();
}

export interface Adjustment {
  /** Days to take off our estimate for this item. */
  shortenBy: number;
  /** How many throw-aways this is based on. */
  basedOn: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.floor((s[mid - 1] + s[mid]) / 2);
};

/** The most days our own estimate gives an item outside the freezer. */
function longestEstimate(name: string): number {
  const est = estimateShelfLife(name);
  return Math.max(est.days, est.ifStoredDifferently.fridge ?? 0, est.ifStoredDifferently.counter ?? 0);
}

export function learnFromOutcomes(outcomes: Outcome[]): Map<string, Adjustment> {
  const early = new Map<string, number[]>();
  const ceilings = new Map<string, number>();
  for (const o of outcomes) {
    if (o.outcome !== "expired") continue;
    const left = Math.round(Number(o.days_left_at_removal));
    if (!Number.isFinite(left) || left <= 0) continue;
    // More days left than our estimate ever gives: the date was the pack's or the person's, which says nothing about ours.
    if (!ceilings.has(o.name)) ceilings.set(o.name, longestEstimate(o.name));
    if (left > ceilings.get(o.name)!) continue;
    const key = learningKey(o.name);
    if (!early.has(key)) early.set(key, []);
    early.get(key)!.push(left);
  }

  const result = new Map<string, Adjustment>();
  for (const [key, lefts] of early) {
    if (lefts.length < MIN_EVENTS) continue;
    const shortenBy = median(lefts);
    if (shortenBy > 0) result.set(key, { shortenBy, basedOn: lefts.length });
  }
  return result;
}

/**
 * Our estimate for this item, shortened if the household's history says so.
 * Never below 1 day — an item just added is not already due.
 */
export function adjustEstimate(
  name: string,
  days: number,
  learned: Map<string, Adjustment>
): { days: number; note: string | null } {
  const adj = learned.get(learningKey(name));
  if (!adj) return { days, note: null };
  const adjusted = Math.max(1, days - adj.shortenBy);
  if (adjusted >= days) return { days, note: null };
  return {
    days: adjusted,
    note: `Shortened by ${adj.shortenBy} ${adj.shortenBy === 1 ? "day" : "days"}: you have thrown this out ${adj.basedOn} times with days still left.`,
  };
}
