import { describe, expect, it } from "vitest";
import { asDateKind, dateLabel, dueLine, pastDateMessage, resolveDateKind } from "./date-kind";

describe("resolveDateKind", () => {
  it("takes the model's answer when it is one of the two kinds", () => {
    expect(resolveDateKind("use_by", "Best before 12/03/27")).toBe("use_by");
    expect(resolveDateKind("best_before", "")).toBe("best_before");
  });

  it("reads the printed words when the model gave nothing", () => {
    expect(resolveDateKind(null, "Best Before 6 months from packing")).toBe("best_before");
    expect(resolveDateKind(null, "BB: 12/03/27")).toBe("best_before");
    expect(resolveDateKind(undefined, "EXP 03/2027")).toBe("use_by");
    expect(resolveDateKind(undefined, "Use by 14 Nov")).toBe("use_by");
    expect(resolveDateKind(undefined, "Expiry Date: 01/01/27")).toBe("use_by");
  });

  it("reads FSSAI's abbreviations", () => {
    expect(resolveDateKind(null, "BBD 05/2027")).toBe("best_before");
    expect(resolveDateKind(null, "B.B. MAY 2027")).toBe("best_before");
    expect(resolveDateKind(null, "UBD: 31/10/26")).toBe("use_by");
    expect(resolveDateKind(null, "UB 31/10/26")).toBe("use_by");
    expect(resolveDateKind(null, "EXD. 05/27")).toBe("use_by");
    expect(resolveDateKind(null, "PKD 01/26 ED 12/26")).toBe("use_by");
  });

  it("does not mistake BBQ for a best-before mark, and stays unknown when unsure", () => {
    expect(resolveDateKind(null, "BBQ sauce 12/03/27")).toBeNull();
    expect(resolveDateKind(null, "Packed 12/03/27")).toBeNull();
    expect(resolveDateKind(null, "12/03/27")).toBeNull();
    expect(resolveDateKind("sometime", 42)).toBeNull();
  });
});

describe("pastDateMessage", () => {
  it("is firm about a use-by date and gentle about a best-before date", () => {
    expect(pastDateMessage("use_by")).toMatch(/don't eat it/);
    expect(pastDateMessage("best_before")).toMatch(/not necessarily unsafe/);
    expect(pastDateMessage(null)).toBeNull();
  });

  it("covers both readings when a pack's date is of an unknown kind", () => {
    expect(pastDateMessage(null, true)).toMatch(/use by or expiry, don't eat it; .*best before, look/);
  });
});

describe("dateLabel and dueLine", () => {
  const line = (o: Partial<Parameters<typeof dueLine>[0]>) =>
    dueLine({ kind: null, origin: null, date: "31 Oct", daysLeft: 3, daysPast: 0, ...o });

  it("only calls a date 'use by' when it is one", () => {
    expect(dateLabel("use_by", "printed")).toBe("Use by");
    expect(dateLabel("best_before", "user")).toBe("Best before");
    expect(dateLabel(null, "printed")).toBe("Date on pack");
    expect(dateLabel(null, null)).toBe("Good till about");
  });

  it("names the date while it is ahead", () => {
    expect(line({ kind: "best_before", origin: "printed" })).toBe("Best before 31 Oct");
    expect(line({})).toBe("Good till about 31 Oct");
  });

  it("treats the date itself as today, not as past", () => {
    expect(line({ kind: "use_by", origin: "printed", daysLeft: 0 })).toBe("Use by today");
    expect(line({ daysLeft: 0 })).toBe("Our estimate runs out today");
  });

  it("says how long ago a date passed", () => {
    expect(line({ kind: "best_before", origin: "printed", date: "24 Oct", daysLeft: 0, daysPast: 3 })).toBe("Best before 24 Oct, 3 days ago");
    expect(line({ date: "26 Oct", daysLeft: 0, daysPast: 1 })).toBe("Our estimate ran out 26 Oct, 1 day ago");
  });
});

describe("asDateKind", () => {
  it("accepts only the two kinds", () => {
    expect(asDateKind("use_by")).toBe("use_by");
    expect(asDateKind("expiry")).toBeNull();
  });
});
