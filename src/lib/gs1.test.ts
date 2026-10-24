import { describe, expect, it } from "vitest";
import { gs1PrintedDate, gs1UseByDate, parseGs1, parseGs1Date } from "./gs1";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe("parseGs1Date", () => {
  it("reads YYMMDD", () => expect(iso(parseGs1Date("270131"))).toBe("2027-01-31"));
  it("treats day 00 as the last day of the month", () => expect(iso(parseGs1Date("260200"))).toBe("2026-02-28"));
  it("rejects impossible dates", () => {
    expect(parseGs1Date("261301")).toBeNull();
    expect(parseGs1Date("260231")).toBeNull();
    expect(parseGs1Date("2601")).toBeNull();
  });
});

describe("parseGs1", () => {
  it("returns null for a plain EAN-13, which carries no date", () => {
    expect(parseGs1("8901058000290")).toBeNull();
    expect(parseGs1("")).toBeNull();
  });

  it("reads the bracketed human-readable form", () => {
    const g = parseGs1("(01)08901058000290(17)270131(10)AB12");
    expect(g?.gtin).toBe("08901058000290");
    expect(g?.lookupCode).toBe("8901058000290");
    expect(iso(g?.expiry ?? null)).toBe("2027-01-31");
  });

  it("reads the raw form with a symbology prefix and group separators", () => {
    const g = parseGs1("]d2010890105800029010AB12\u001d17270131");
    expect(g?.lookupCode).toBe("8901058000290");
    expect(iso(g?.expiry ?? null)).toBe("2027-01-31");
  });

  it("reads best-before and production dates", () => {
    const g = parseGs1("01089010580002901526063011260101");
    expect(iso(g?.bestBefore ?? null)).toBe("2026-06-30");
    expect(iso(g?.production ?? null)).toBe("2026-01-01");
    expect(iso(gs1UseByDate(g))).toBe("2026-06-30");
  });

  it("prefers expiry over best-before", () => {
    const g = parseGs1("(01)08901058000290(15)260630(17)260615");
    expect(iso(gs1UseByDate(g))).toBe("2026-06-15");
  });
});

describe("gs1PrintedDate", () => {
  it("names AI 17 as a use-by date and AI 15 as best-before", () => {
    expect(gs1PrintedDate(parseGs1("(01)08901058000290(17)270131"))?.kind).toBe("use_by");
    expect(gs1PrintedDate(parseGs1("(01)08901058000290(15)270131"))?.kind).toBe("best_before");
    expect(gs1PrintedDate(parseGs1("(01)08901058000290"))).toBeNull();
  });
});
