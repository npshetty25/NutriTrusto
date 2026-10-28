import { describe, expect, it } from "vitest";
import { planWeek, shoppingForPlan } from "./meal-plan";
import { EMPTY_PROFILE } from "./food-profile";

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

describe("planWeek with a food profile", () => {
  const monday = new Date(2026, 9, 26); // a Monday
  const pantry = [item("Paneer", 5), item("Spinach", 5), item("Potatoes", 20), item("Onions", 20), item("Cauliflower", 5)];

  it("leaves a fasting weekday empty and plans the others", () => {
    const plan = planWeek(pantry, "none", 3, { profile: { ...EMPTY_PROFILE, fastingDays: [2] }, today: monday });
    expect(plan[1]).toMatchObject({ day: 1, fasting: true, dish: "" });
    expect(plan[0].fasting).toBeUndefined();
    expect(plan[2].fasting).toBeUndefined();
  });

  it("a fasting day uses nothing up", () => {
    const withFast = planWeek(pantry, "none", 3, { profile: { ...EMPTY_PROFILE, fastingDays: [1] }, today: monday });
    expect(withFast[0]).toMatchObject({ fasting: true });
    expect(withFast[1].dish).toBe(planWeek(pantry, "none", 1, { today: monday })[0].dish);
  });

  it("never plans a dish with a Jain-forbidden ingredient", () => {
    const plan = planWeek(pantry, "none", 7, { profile: { ...EMPTY_PROFILE, jain: true }, today: monday });
    expect(plan.length).toBeGreaterThan(0);
    for (const m of plan) expect(m.uses.join(" ")).not.toMatch(/potato|onion/i);
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
