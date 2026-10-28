import type { StorageLocation } from "@/lib/temperature";

/**
 * How long cooked food keeps once it is a leftover.
 *
 * USDA FSIS, "Leftovers and Food Safety": refrigerate within 2 hours of
 * cooking (1 hour above 90 °F / 32 °C), and eat refrigerated leftovers within
 * 3 to 4 days or freeze them for 3 to 4 months. The ranges are rounded DOWN, to
 * 3 days and 90 days, because a too-long estimate is the unsafe way to be wrong.
 *
 * On the counter there is no safe keeping time to give: the 2-hour limit is
 * already the limit. A leftover that has not gone into the fridge or freezer
 * is therefore "eat today", and one that sat out too long is not added at all.
 */
export const LEFTOVER_PREFIX = "Leftover ";

export const LEFTOVER_CITATION = "USDA FSIS, Leftovers and Food Safety: 3 to 4 days in the fridge, 3 to 4 months frozen";

export type LeftoverPlan =
  | { ok: true; days: number; note: string }
  | { ok: false; reason: string };

export function leftoverPlan(storage: StorageLocation, leftOutOverTwoHours: boolean): LeftoverPlan {
  if (leftOutOverTwoHours) {
    return {
      ok: false,
      reason: "Cooked food left out for more than 2 hours (1 hour in a hot kitchen) is not safe to keep. Throw it away.",
    };
  }
  if (storage === "fridge") return { ok: true, days: 3, note: "Eat within 3 days. Reheat until steaming hot." };
  if (storage === "freezer") return { ok: true, days: 90, note: "Freezes for months. Reheat until steaming hot." };
  return { ok: true, days: 0, note: "Not in the fridge yet: eat it today, or put it in the fridge within 2 hours of cooking." };
}

const firstWord = (name: string) => name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

export const isLeftover = (name: string) => firstWord(name) === "leftover";

/** "dal" and "Leftover dal" both give "Leftover dal". */
export function leftoverName(dish: string): string {
  const clean = dish.trim().replace(/\s+/g, " ");
  return isLeftover(clean) ? clean : `${LEFTOVER_PREFIX}${clean}`;
}
