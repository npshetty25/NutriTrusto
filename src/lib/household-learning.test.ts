import { describe, expect, it } from "vitest";
import { adjustEstimate, learnFromOutcomes, learningKey, MIN_EVENTS, type Outcome } from "./household-learning";

const thrown = (name: string, left: number): Outcome => ({ name, outcome: "expired", days_left_at_removal: left });
const used = (name: string, left: number): Outcome => ({ name, outcome: "used", days_left_at_removal: left });

describe("learnFromOutcomes", () => {
  it("says nothing until the same item has been thrown out early enough times", () => {
    const few = Array.from({ length: MIN_EVENTS - 1 }, () => thrown("Coriander Leaves", 2));
    expect(learnFromOutcomes(few).size).toBe(0);
  });

  it("learns the typical overshoot from repeated early throw-aways", () => {
    const learned = learnFromOutcomes([thrown("Coriander Leaves", 1), thrown("Coriander Leaves", 2), thrown("Coriander Leaves", 3)]);
    expect(learned.get(learningKey("Coriander Leaves"))).toEqual({ shortenBy: 2, basedOn: 3 });
  });

  it("ignores items used up, and items thrown out with no days left", () => {
    const learned = learnFromOutcomes([
      used("Milk", 3), used("Milk", 3), used("Milk", 3),
      thrown("Milk", 0), thrown("Milk", 0), thrown("Milk", 0),
    ]);
    expect(learned.size).toBe(0);
  });

  it("treats name variants of the same item as one", () => {
    expect(learningKey("Palak (Spinach)")).toBe(learningKey("Spinach"));
  });
});

describe("adjustEstimate", () => {
  const learned = learnFromOutcomes([thrown("Coriander Leaves", 2), thrown("Coriander Leaves", 2), thrown("Coriander", 2)]);

  it("only ever shortens, and says why", () => {
    const r = adjustEstimate("Coriander Leaves", 5, learned);
    expect(r.days).toBe(3);
    expect(r.note).toMatch(/thrown this out 3 times/);
  });

  it("never goes below one day", () => {
    expect(adjustEstimate("Coriander Leaves", 2, learned).days).toBe(1);
  });

  it("leaves an item with no history alone", () => {
    expect(adjustEstimate("Basmati Rice", 300, learned)).toEqual({ days: 300, note: null });
  });
});
