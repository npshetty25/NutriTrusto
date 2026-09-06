/**
 * How old an item is, and how far past our estimate it has gone.
 *
 * These three functions were inline in `app/page.tsx`. They are pure and they
 * gate what the recipe generator is allowed to show the model, so they belong
 * somewhere a test can reach them.
 *
 * The distinction the last function exists for: `calculateCurrentDaysLeft`
 * clamps at zero, so a bag of palak one day past its estimate and one a month
 * past both read as `0` — the same value as a bag that is due today and
 * perfectly fine. Anything deciding whether food may be recommended needs to
 * tell those apart, so the overshoot the clamp discards is kept separately
 * rather than recovered by letting `daysLeft` go negative (which every display
 * site would then have to re-clamp).
 */

/** Falls back to today on an unparseable date rather than throwing. */
export const parsePurchaseDate = (purchaseDate: string) => {
  const parsed = new Date(purchaseDate);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
};

/**
 * Whole days since purchase, never negative — a purchase date in the future
 * (clock skew, a mistyped manual entry) counts as zero days elapsed rather
 * than lengthening the item's life.
 */
export const daysElapsedSince = (purchaseDate: string) => {
  const msDiff = new Date().getTime() - parsePurchaseDate(purchaseDate).getTime();
  return Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));
};

/** Days remaining, floored at zero. This is what the UI displays. */
export const calculateCurrentDaysLeft = (initialDaysLeft: number, purchaseDate: string) =>
  Math.max(0, initialDaysLeft - daysElapsedSince(purchaseDate));

/**
 * Days elapsed *beyond* the estimate; 0 while still within it. Nothing
 * displays this — it is the flag that keeps past-estimate food out of the
 * recipe prompt, whose most urgent bucket is headed "MUST USE".
 */
export const calculateDaysPastEstimate = (initialDaysLeft: number, purchaseDate: string) =>
  Math.max(0, daysElapsedSince(purchaseDate) - initialDaysLeft);
