import { describe, expect, it } from "vitest";
import { addMonths, addDays, daysBetween, parsePrintedDate, resolvePrintedDate } from "./printed-date";

const TODAY = "2026-10-27";

describe("parsePrintedDate", () => {
  it("keeps whether a day was printed", () => {
    expect(parsePrintedDate("2027-05-31")).toEqual({ y: 2027, m: 5, d: 31 });
    expect(parsePrintedDate("2027-05")).toEqual({ y: 2027, m: 5, d: null });
  });

  it("rejects impossible dates instead of rolling them over", () => {
    expect(parsePrintedDate("2027-02-30")).toBeNull();
    expect(parsePrintedDate("2027-13")).toBeNull();
    expect(parsePrintedDate("31/05/2027")).toBeNull();
    expect(parsePrintedDate(null)).toBeNull();
  });
});

describe("calendar arithmetic", () => {
  it("adds calendar months, not 30-day blocks", () => {
    expect(addMonths("2026-01-15", 24)).toBe("2028-01-15");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2027-11-30", 3)).toBe("2028-02-29");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(daysBetween("2026-10-27", "2026-11-03")).toBe(7);
    expect(daysBetween("2026-10-27", "2026-10-20")).toBe(-7);
  });
});

describe("resolvePrintedDate", () => {
  it("uses a printed day as it is", () => {
    const r = resolvePrintedDate({ expiry: "2026-11-30" }, TODAY);
    expect(r).toMatchObject({ expiryDate: "2026-11-30", source: "printed_expiry", needsCheck: false, notes: [] });
  });

  it("reads a month-only date to the end of that month, and says so", () => {
    const r = resolvePrintedDate({ expiry: "2027-05" }, TODAY);
    expect(r.expiryDate).toBe("2027-05-31");
    expect(r.notes[0]).toMatch(/end of May 2027/);
    expect(resolvePrintedDate({ expiry: "2028-02" }, TODAY).expiryDate).toBe("2028-02-29");
  });

  it("counts 'best before N months from packing' in calendar months", () => {
    const r = resolvePrintedDate({ mfd: "2026-01-15", shelfLifeValue: 24, shelfLifeUnit: "months" }, TODAY);
    // 24 × 30 days used to land on 2028-01-05, ten days early.
    expect(r).toMatchObject({ expiryDate: "2028-01-15", source: "mfd_plus_shelf_life" });
    expect(resolvePrintedDate({ mfd: "2026-10-01", shelfLifeValue: 1, shelfLifeUnit: "years" }, TODAY).expiryDate).toBe("2027-10-01");
    expect(resolvePrintedDate({ mfd: "2026-10-25", shelfLifeValue: 5, shelfLifeUnit: "days" }, TODAY).expiryDate).toBe("2026-10-30");
  });

  it("counts a month-only packing date from the 1st, and says so", () => {
    const r = resolvePrintedDate({ mfd: "2026-08", shelfLifeValue: 9, shelfLifeUnit: "months" }, TODAY);
    expect(r.expiryDate).toBe("2027-05-01");
    expect(r.notes[0]).toMatch(/packed \(August 2026\).*from the 1st/);
  });

  it("flags a duration counted from today, because the pack was made earlier", () => {
    const r = resolvePrintedDate({ shelfLifeValue: 6, shelfLifeUnit: "months" }, TODAY);
    expect(r).toMatchObject({ expiryDate: "2027-04-27", source: "shelf_life_from_today", needsCheck: true });
    expect(r.notes[0]).toMatch(/real date is sooner/);
  });

  it("ignores a packing date in the future", () => {
    const r = resolvePrintedDate({ mfd: "2027-03-01", shelfLifeValue: 6, shelfLifeUnit: "months" }, TODAY);
    expect(r.source).toBe("shelf_life_from_today");
  });

  it("throws out an expiry before the packing date and falls back to the duration", () => {
    const r = resolvePrintedDate({ expiry: "2025-01-10", mfd: "2026-09-01", shelfLifeValue: 6, shelfLifeUnit: "months" }, TODAY);
    expect(r).toMatchObject({ expiryDate: "2027-03-01", source: "mfd_plus_shelf_life", needsCheck: true });
  });

  it("treats a date years in the past or far ahead as a misread", () => {
    expect(resolvePrintedDate({ expiry: "2023-05-01" }, TODAY)).toMatchObject({ expiryDate: null, needsCheck: true });
    expect(resolvePrintedDate({ expiry: "2045-05-01" }, TODAY).expiryDate).toBeNull();
  });

  it("keeps a pack that is genuinely past its date", () => {
    expect(resolvePrintedDate({ expiry: "2026-10-20" }, TODAY).expiryDate).toBe("2026-10-20");
  });

  it("returns nothing when nothing usable was printed", () => {
    expect(resolvePrintedDate({}, TODAY)).toEqual({ expiryDate: null, source: "unknown", notes: [], needsCheck: false });
    expect(resolvePrintedDate({ shelfLifeValue: "lots", shelfLifeUnit: "months" }, TODAY).expiryDate).toBeNull();
  });
});
