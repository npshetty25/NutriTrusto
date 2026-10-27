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
 *
 * Days are CALENDAR days in the person's own timezone. They used to be
 * 24-hour periods counted from midnight UTC, because `new Date("2026-10-27")`
 * reads a bare date as UTC. In India that put the start of each day at
 * 5:30 am: between midnight and 5:30 every card showed one day more than it
 * should, and an item added in those hours was stored as bought the day
 * before, so a date read off the pack came out a day short for the item's
 * whole life.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

/** `d` (default now) as YYYY-MM-DD in the person's own calendar. */
export const localDateISO = (d: Date = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * The calendar day a stored date names, as a whole day number. A bare
 * YYYY-MM-DD (how Postgres returns a `date`) is that day as written; a full
 * timestamp is the day it falls on here.
 */
function calendarDay(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) / DAY_MS;
}

const today = (now: Date) => Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS;

/** Local midnight of the purchase day; today on an unparseable date rather than throwing. */
export const parsePurchaseDate = (purchaseDate: string) => {
  const day = calendarDay(purchaseDate);
  if (day === null) return new Date();
  const d = new Date(day * DAY_MS);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/**
 * Whole calendar days since purchase, never negative — a purchase date in
 * the future (clock skew, a mistyped manual entry) counts as zero days
 * elapsed rather than lengthening the item's life.
 */
export const daysElapsedSince = (purchaseDate: string, now: Date = new Date()) => {
  const bought = calendarDay(purchaseDate);
  if (bought === null) return 0;
  return Math.max(0, Math.round(today(now) - bought));
};

/** Days remaining, floored at zero. This is what the UI displays. */
export const calculateCurrentDaysLeft = (initialDaysLeft: number, purchaseDate: string, now: Date = new Date()) =>
  Math.max(0, initialDaysLeft - daysElapsedSince(purchaseDate, now));

/**
 * Days elapsed *beyond* the estimate; 0 while still within it. It is the flag
 * that keeps past-estimate food out of the recipe prompt, whose most urgent
 * bucket is headed "USE FIRST", and the "N days past" a card shows.
 */
export const calculateDaysPastEstimate = (initialDaysLeft: number, purchaseDate: string, now: Date = new Date()) =>
  Math.max(0, daysElapsedSince(purchaseDate, now) - initialDaysLeft);

/**
 * The item's last good day as YYYY-MM-DD, from what a card already knows:
 * today plus the days left, or minus the days it is past. For a date read
 * off the pack this is that printed date exactly. Calendar arithmetic, not
 * now + N × 24 h, which lands on the wrong day near midnight.
 */
export function dueDateFromToday(daysLeft: number, daysPast = 0, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + Math.round(daysPast > 0 ? -daysPast : daysLeft));
  return localDateISO(d);
}
