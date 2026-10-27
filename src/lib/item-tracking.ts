import { estimateShelfLife } from "@/lib/shelf-life";
import { daysElapsedSince } from "@/lib/item-age";
import type { StorageLocation } from "@/lib/temperature";
import type { DateKind } from "@/lib/date-kind";

/**
 * Where an item is kept, whether it has been opened, and where its date came
 * from — and what each of those does to "days left".
 *
 * Three rules, all deliberately one-directional:
 *
 *   1. A date from the pack ('printed') or typed by the person ('user') is
 *      never recomputed by the app. Moving a carton of milk with a printed
 *      date to the counter does not earn it more days from our model; the
 *      date stays what the pack says.
 *   2. Opening only ever SHORTENS. "Use within N days of opening" is a limit
 *      on top of whatever was left, never an extension.
 *   3. Moving storage rescales an ESTIMATE only where the shelf-life model
 *      will actually advise for that item. Where it declines (bananas in a
 *      fridge, bread, anything frozen), nothing changes and the person is
 *      told to set the date themselves — the app does not invent a number.
 */

export type ExpirySource = "printed" | "user" | null;

export const STORAGE_OPTIONS: { id: StorageLocation; label: string }[] = [
  { id: "fridge", label: "Fridge" },
  { id: "counter", label: "Shelf" },
  { id: "freezer", label: "Freezer" },
];

/** "Use within N days of opening" choices — the figure printed on most packs. */
export const OPENED_DAYS_OPTIONS = [1, 2, 3, 5, 7, 14, 30] as const;

/** The storage the shelf-life table assumes for this item, when not told. */
export function defaultStorageFor(name: string): StorageLocation {
  return estimateShelfLife(name).storage;
}

export type StorageChange =
  | { changed: true; daysLeft: number }
  | { changed: false; daysLeft: number; reason: string };

/**
 * Days left after moving an item from one storage to another.
 *
 * Scales what is LEFT by the ratio of the two storage lifetimes, so an item
 * halfway through its fridge life is halfway through its counter life too.
 */
export function daysLeftAfterMove(
  name: string,
  daysLeft: number,
  from: StorageLocation,
  to: StorageLocation,
  expirySource: ExpirySource
): StorageChange {
  if (from === to) return { changed: false, daysLeft, reason: "" };
  if (expirySource === "printed") {
    return { changed: false, daysLeft, reason: "Keeping the date printed on the pack." };
  }
  if (expirySource === "user") {
    return { changed: false, daysLeft, reason: "Keeping the date you set." };
  }

  const est = estimateShelfLife(name);
  const lifeAt = (loc: StorageLocation): number | null =>
    loc === est.storage ? est.days : est.ifStoredDifferently[loc];
  const fromLife = lifeAt(from);
  const toLife = lifeAt(to);

  if (!fromLife || toLife === null || toLife === undefined) {
    return {
      changed: false,
      daysLeft,
      reason: "We can't estimate how that changes it — set the date yourself if you know it.",
    };
  }
  return { changed: true, daysLeft: Math.max(0, Math.floor(daysLeft * (toLife / fromLife))) };
}

/** Days left once opened: never more than what was left, never more than N. */
export function daysLeftAfterOpening(daysLeft: number, useWithinDays: number): number {
  return Math.max(0, Math.min(daysLeft, Math.floor(useWithinDays)));
}

/**
 * What opening a pack does to its date. A printed date is for the UNOPENED
 * pack — Codex defines best before as the end of the period in which "the
 * unopened product will remain fully marketable" — so once it is opened, the
 * use-within limit takes over wherever it is sooner. The date is then no
 * longer the pack's, and stops being labelled as one; where the pack's date
 * is still the sooner of the two, it stays exactly as it was.
 */
export function afterOpening(
  item: { daysLeft: number; expirySource: ExpirySource; expiryKind: DateKind | null },
  useWithinDays: number
): { daysLeft: number; expirySource: ExpirySource; expiryKind: DateKind | null; shortened: boolean } {
  const daysLeft = daysLeftAfterOpening(item.daysLeft, useWithinDays);
  if (daysLeft >= item.daysLeft) return { ...item, shortened: false };
  return { daysLeft, expirySource: null, expiryKind: null, shortened: true };
}

/**
 * The value to store in pantry_items.days_left so the item shows `daysLeft`
 * remaining today. days_left is the item's full life from purchase_date, and
 * the UI subtracts the days elapsed — so this adds them back rather than
 * resetting purchase_date, which would lose when the item was really bought.
 */
export function storedDaysLeftFor(daysLeft: number, purchaseDate: string): number {
  return Math.max(0, Math.min(3650, Math.round(daysLeft) + daysElapsedSince(purchaseDate)));
}

/** Whole days from today until a YYYY-MM-DD date, floored at 0. Null when unreadable. */
export function daysUntilDate(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(target)) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((target - today) / (24 * 60 * 60 * 1000)));
}

/** Today plus N days, as YYYY-MM-DD in the person's own calendar. */
export function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
