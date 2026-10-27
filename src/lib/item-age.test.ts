import { describe, it, expect } from "vitest";
import {
  parsePurchaseDate,
  daysElapsedSince,
  calculateCurrentDaysLeft,
  calculateDaysPastEstimate,
  dueDateFromToday,
  localDateISO,
  remainingFor,
} from "./item-age";

describe("remainingFor", () => {
  const now = new Date(2026, 9, 28, 1, 0); // 1 am here: still the 27th in UTC

  it("counts from the item's own date when it has one, past it included", () => {
    // Scanned today, printed 30 Sep: days_left could only hold 0.
    expect(remainingFor({ days_left: 0, purchase_date: "2026-10-28", expiry_date: "2026-09-30" }, now)).toEqual({ daysLeft: 0, daysPast: 28 });
    expect(remainingFor({ days_left: 3, purchase_date: "2026-10-28", expiry_date: "2026-10-31" }, now)).toEqual({ daysLeft: 3, daysPast: 0 });
    expect(remainingFor({ days_left: 0, purchase_date: "2026-10-28", expiry_date: "2026-10-28" }, now)).toEqual({ daysLeft: 0, daysPast: 0 });
  });

  it("falls back to the life counted from purchase without one", () => {
    expect(remainingFor({ days_left: 5, purchase_date: "2026-10-25" }, now)).toEqual({ daysLeft: 2, daysPast: 0 });
    expect(remainingFor({ days_left: 1, purchase_date: "2026-10-25", expiry_date: null }, now)).toEqual({ daysLeft: 0, daysPast: 2 });
  });
});

describe("calendar days, in the person's own timezone", () => {
  // Built with local-time constructors, so these hold in any timezone. In
  // India the old 24-hours-from-midnight-UTC count failed the first two.
  it("a new day starts at local midnight, not at midnight UTC", () => {
    expect(daysElapsedSince("2026-10-27", new Date(2026, 9, 28, 1, 0))).toBe(1);
    expect(daysElapsedSince("2026-10-27", new Date(2026, 9, 27, 23, 59))).toBe(0);
  });

  it("reads a stored timestamp as the local day it falls on", () => {
    const lateLastNight = new Date(2026, 9, 27, 23, 30).toISOString();
    expect(daysElapsedSince(lateLastNight, new Date(2026, 9, 28, 0, 30))).toBe(1);
    expect(daysElapsedSince(lateLastNight, new Date(2026, 9, 27, 23, 45))).toBe(0);
  });

  it("keeps a printed date's count exact for the item's whole life", () => {
    // Pack says 31 Oct; scanned at 1 am on 28 Oct, so stored as 3 days from 28 Oct.
    expect(calculateCurrentDaysLeft(3, "2026-10-28", new Date(2026, 9, 28, 6, 0))).toBe(3);
    expect(calculateCurrentDaysLeft(3, "2026-10-28", new Date(2026, 9, 31, 2, 0))).toBe(0);
    expect(calculateDaysPastEstimate(3, "2026-10-28", new Date(2026, 9, 31, 23, 0))).toBe(0);
    expect(calculateDaysPastEstimate(3, "2026-10-28", new Date(2026, 10, 1, 0, 5))).toBe(1);
  });

  it("writes today's date in the local calendar", () => {
    expect(localDateISO(new Date(2026, 0, 5, 0, 30))).toBe("2026-01-05");
    expect(localDateISO(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("works out the due date by the calendar, across month ends", () => {
    const now = new Date(2026, 9, 29, 23, 50);
    expect(dueDateFromToday(5, 0, now)).toBe("2026-11-03");
    expect(dueDateFromToday(0, 0, now)).toBe("2026-10-29");
    expect(dueDateFromToday(0, 3, now)).toBe("2026-10-26");
  });

  it("parses a bare date as local midnight of that day", () => {
    const d = parsePurchaseDate("2026-10-27");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 27, 0]);
  });
});

/** An ISO date `n` whole days before now. */
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe("daysElapsedSince", () => {
  it("counts whole elapsed days", () => {
    expect(daysElapsedSince(daysAgo(0))).toBe(0);
    expect(daysElapsedSince(daysAgo(1))).toBe(1);
    expect(daysElapsedSince(daysAgo(30))).toBe(30);
  });

  it("never returns a negative for a future purchase date", () => {
    // Clock skew or a mistyped manual entry must not extend an item's life.
    expect(daysElapsedSince(daysAgo(-10))).toBe(0);
  });

  it("falls back to today rather than NaN on an unparseable date", () => {
    expect(daysElapsedSince("not a date")).toBe(0);
    expect(Number.isNaN(parsePurchaseDate("not a date").getTime())).toBe(false);
  });
});

describe("calculateCurrentDaysLeft", () => {
  it("counts down as the item ages", () => {
    expect(calculateCurrentDaysLeft(10, daysAgo(0))).toBe(10);
    expect(calculateCurrentDaysLeft(10, daysAgo(4))).toBe(6);
    expect(calculateCurrentDaysLeft(10, daysAgo(10))).toBe(0);
  });

  it("clamps at zero instead of going negative", () => {
    expect(calculateCurrentDaysLeft(10, daysAgo(11))).toBe(0);
    expect(calculateCurrentDaysLeft(10, daysAgo(400))).toBe(0);
  });
});

describe("calculateDaysPastEstimate", () => {
  it("is zero while the item is still within its estimate", () => {
    expect(calculateDaysPastEstimate(10, daysAgo(0))).toBe(0);
    expect(calculateDaysPastEstimate(10, daysAgo(9))).toBe(0);
  });

  it("is zero on the exact day the estimate runs out", () => {
    // "Due today" is not "past". This item stays eligible for a recipe.
    expect(calculateDaysPastEstimate(10, daysAgo(10))).toBe(0);
  });

  it("counts the overshoot once the estimate is passed", () => {
    expect(calculateDaysPastEstimate(10, daysAgo(11))).toBe(1);
    expect(calculateDaysPastEstimate(10, daysAgo(40))).toBe(30);
  });

  it("separates two items that daysLeft alone reports identically", () => {
    // This is the whole reason the function exists. Both of these are `0`
    // days left; only one of them may be put in front of the recipe model.
    const dueToday = daysAgo(5);
    const longGone = daysAgo(35);

    expect(calculateCurrentDaysLeft(5, dueToday)).toBe(0);
    expect(calculateCurrentDaysLeft(5, longGone)).toBe(0);

    expect(calculateDaysPastEstimate(5, dueToday)).toBe(0);
    expect(calculateDaysPastEstimate(5, longGone)).toBe(30);
  });
});
