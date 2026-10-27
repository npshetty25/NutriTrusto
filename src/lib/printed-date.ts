/**
 * Turns what a pack prints into one date: the last day it is good until.
 *
 * Indian packs print dates in more shapes than a single YYYY-MM-DD, and the
 * scan route used to squeeze all of them into one:
 *
 *   Month and year only — "EXP MAY 2027", "BB 05/27". FSSAI allows this on
 *     anything that keeps more than three months (FAQ on the Labelling &
 *     Display Regulations 2020, Q3, example "Mfg.date: MAY 2021"). The model
 *     had to invent a day. Codex's labelling standard (CXS 1-1985, 4.7.1)
 *     says how such a date reads: "Best before end …" — so it runs to the
 *     LAST day of that month.
 *   A packing date plus a duration — "Best before 9 months from packaging",
 *     the older format FSSAI still accepts (FAQ Q19). Months were counted as
 *     30 days, which put a 24-month pack 10 days short; they are calendar
 *     months now. A packing month with no day counts from the 1st, the
 *     earliest it could have been packed.
 *   A duration alone, the date stamp unreadable. Counted from today, which is
 *     later than the pack was made, so the result says so and asks for a check.
 *
 * Dates are calendar dates (YYYY-MM-DD) throughout, and the day count is
 * worked out on the phone, where "today" is the person's own.
 */

export type PrintedDateSource = "printed_expiry" | "mfd_plus_shelf_life" | "shelf_life_from_today" | "unknown";

export interface PrintedFields {
  expiry?: unknown;
  mfd?: unknown;
  shelfLifeValue?: unknown;
  shelfLifeUnit?: unknown;
}

export interface ResolvedPrintedDate {
  /** Last good day, YYYY-MM-DD; null when nothing usable was printed. */
  expiryDate: string | null;
  source: PrintedDateSource;
  /** What the person should know about how the date was worked out. */
  notes: string[];
  /** True when the result should be checked against the pack. */
  needsCheck: boolean;
}

interface PrintedDay {
  y: number;
  m: number;
  /** Null when only the month and year were printed. */
  d: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (p: PrintedDay) => `${MONTHS[p.m - 1]} ${p.y}`;

/** "2027-05-31" (a day) or "2027-05" (a month only); null for anything else. */
export function parsePrintedDate(value: unknown): PrintedDay | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = match[3] ? Number(match[3]) : null;
  if (m < 1 || m > 12) return null;
  if (d !== null && (d < 1 || d > daysInMonth(y, m))) return null;
  return { y, m, d };
}

/** Calendar months, keeping the day where the month allows: 31 Jan + 1 = 28/29 Feb. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return iso(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Whole days from `from` to `to`, both YYYY-MM-DD; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

function addDuration(start: string, value: unknown, unit: unknown): string | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 3650) return null;
  if (unit === "days") return addDays(start, Math.round(n));
  if (unit === "months") return addMonths(start, Math.round(n));
  if (unit === "years") return addMonths(start, Math.round(n * 12));
  return null;
}

/** An expiry this far in the past is a misread year, not a pack still in a kitchen. */
const MAX_DAYS_PAST = 365;
const MAX_DAYS_AHEAD = 3650;

/**
 * @param today the person's own today, YYYY-MM-DD.
 */
export function resolvePrintedDate(fields: PrintedFields, today: string): ResolvedPrintedDate {
  const notes: string[] = [];
  let misread = false;
  const expiry = parsePrintedDate(fields.expiry);
  const rawMfd = parsePrintedDate(fields.mfd);
  // A packing date in the future is a misread, not a fact to count from.
  const mfdStart = rawMfd ? iso(rawMfd.y, rawMfd.m, rawMfd.d ?? 1) : null;
  const mfd = rawMfd && mfdStart && mfdStart <= today ? rawMfd : null;

  if (expiry) {
    const end = iso(expiry.y, expiry.m, expiry.d ?? daysInMonth(expiry.y, expiry.m));
    const plausible =
      daysBetween(end, today) <= MAX_DAYS_PAST &&
      daysBetween(today, end) <= MAX_DAYS_AHEAD &&
      // An expiry before the packing date means one of the two was misread.
      !(mfd && mfdStart && end < mfdStart);
    if (plausible) {
      if (expiry.d === null) notes.push(`The pack gives only the month, so this runs to the end of ${monthName(expiry)}.`);
      return { expiryDate: end, source: "printed_expiry", notes, needsCheck: false };
    }
    misread = true;
    notes.push("The printed date didn't look right, so it was not used. Check the pack.");
  }

  if (mfd && mfdStart) {
    const end = addDuration(mfdStart, fields.shelfLifeValue, fields.shelfLifeUnit);
    if (end) {
      if (mfd.d === null) notes.push(`The pack gives only the month it was packed (${monthName(mfd)}), so this counts from the 1st.`);
      return { expiryDate: end, source: "mfd_plus_shelf_life", notes, needsCheck: misread };
    }
  }

  const fromToday = addDuration(today, fields.shelfLifeValue, fields.shelfLifeUnit);
  if (fromToday) {
    notes.push("We couldn't read when it was packed, so this counts from today. It was packed earlier, so the real date is sooner. Check the pack.");
    return { expiryDate: fromToday, source: "shelf_life_from_today", notes, needsCheck: true };
  }

  return { expiryDate: null, source: "unknown", notes, needsCheck: misread };
}
