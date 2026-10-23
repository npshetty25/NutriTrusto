import { describe, expect, it } from "vitest";
import { estimateShelfLife } from "./shelf-life";
import { daysLeftAfterMove, daysLeftAfterOpening, daysUntilDate, dateInDays, storedDaysLeftFor } from "./item-tracking";

describe("daysLeftAfterOpening", () => {
  it("only ever shortens", () => {
    expect(daysLeftAfterOpening(10, 3)).toBe(3);
    expect(daysLeftAfterOpening(2, 7)).toBe(2);
    expect(daysLeftAfterOpening(0, 5)).toBe(0);
  });
});

describe("daysLeftAfterMove", () => {
  it("never touches a printed or user-set date", () => {
    expect(daysLeftAfterMove("Milk", 5, "fridge", "counter", "printed")).toMatchObject({ changed: false, daysLeft: 5 });
    expect(daysLeftAfterMove("Milk", 5, "fridge", "counter", "user")).toMatchObject({ changed: false, daysLeft: 5 });
  });

  it("does nothing for the same storage", () => {
    expect(daysLeftAfterMove("Milk", 5, "fridge", "fridge", null)).toMatchObject({ changed: false, daysLeft: 5 });
  });

  it("declines to guess for the freezer, which the model does not cover", () => {
    const r = daysLeftAfterMove("Paneer", 4, "fridge", "freezer", null);
    expect(r.changed).toBe(false);
    expect(r.daysLeft).toBe(4);
  });

  it("rescales an estimate only where the model advises, in proportion", () => {
    const est = estimateShelfLife("Milk");
    const other = est.storage === "fridge" ? "counter" : "fridge";
    const r = daysLeftAfterMove("Milk", est.days, est.storage, other, null);
    const target = est.ifStoredDifferently[other];
    if (target === null) expect(r.changed).toBe(false);
    else expect(r).toEqual({ changed: true, daysLeft: Math.floor(target) });
  });
});

describe("date helpers", () => {
  it("round-trips today + N", () => {
    expect(daysUntilDate(dateInDays(9))).toBe(9);
    expect(daysUntilDate(dateInDays(0))).toBe(0);
  });
  it("rejects junk", () => expect(daysUntilDate("next tuesday")).toBeNull());
  it("stores days_left relative to the real purchase date", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000).toISOString();
    expect(storedDaysLeftFor(3, fourDaysAgo)).toBe(7);
  });
});
