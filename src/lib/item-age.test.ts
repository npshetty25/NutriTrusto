import { describe, it, expect } from "vitest";
import {
  parsePurchaseDate,
  daysElapsedSince,
  calculateCurrentDaysLeft,
  calculateDaysPastEstimate,
} from "./item-age";

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
