import { describe, expect, it } from "vitest";
import { planWeek, shoppingForPlan } from "./meal-plan";

const item = (name: string, daysLeft: number, daysPastEstimate = 0) => ({ name, daysLeft, daysPastEstimate });

describe("planWeek", () => {
  const pantry = [item("Paneer", 2), item("Spinach", 3), item("Potatoes", 20), item("Cauliflower", 5), item("Eggs", 9)];

  it("plans from what is in the pantry and never repeats a dish", () => {
    const plan = planWeek(pantry, "none");
    expect(plan.length).toBeGreaterThan(1);
    expect(new Set(plan.map((m) => m.dish)).size).toBe(plan.length);
    expect(plan.map((m) => m.day)).toEqual(plan.map((_, i) => i));
  });

  it("does not use the same item two days running", () => {
    const plan = planWeek(pantry, "none");
    const all = plan.flatMap((m) => m.uses);
    expect(new Set(all).size).toBe(all.length);
  });

  it("never plans around food that is already past its date", () => {
    const plan = planWeek([item("Paneer", 0, 6), item("Potatoes", 20)], "none");
    expect(plan.flatMap((m) => m.uses)).not.toContain("Paneer");
  });

  it("keeps to the diet: no egg dish for a vegetarian", () => {
    const plan = planWeek([item("Eggs", 9), item("Spinach", 3), item("Potatoes", 20)], "veg");
    expect(plan.flatMap((m) => m.uses)).not.toContain("Eggs");
  });

  it("is empty for an empty pantry rather than padded with dishes", () => {
    expect(planWeek([], "none")).toEqual([]);
  });

  it("stops at the number of days asked for", () => {
    expect(planWeek(pantry, "none", 2).length).toBeLessThanOrEqual(2);
  });
});

describe("shoppingForPlan", () => {
  it("lists each thing to buy once", () => {
    const list = shoppingForPlan([
      { day: 0, dish: "A", uses: [], toBuy: ["peas", "paneer"] },
      { day: 1, dish: "B", uses: [], toBuy: ["peas"] },
    ]);
    expect(list).toEqual(["peas", "paneer"]);
  });
});
