import { describe, expect, it } from "vitest";
import { asDateKind, pastDateMessage, resolveDateKind } from "./date-kind";

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

  it("does not mistake BBQ for a best-before mark, and stays unknown when unsure", () => {
    expect(resolveDateKind(null, "BBQ sauce 12/03/27")).toBeNull();
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
});

describe("asDateKind", () => {
  it("accepts only the two kinds", () => {
    expect(asDateKind("use_by")).toBe("use_by");
    expect(asDateKind("expiry")).toBeNull();
  });
});
