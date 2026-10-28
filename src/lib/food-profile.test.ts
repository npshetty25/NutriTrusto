import { describe, expect, it } from "vitest";
import { dishesToAvoid, EMPTY_PROFILE, isJainConflict, profileWarnings, readProfile, recipeProblems } from "./food-profile";

const jain = { ...EMPTY_PROFILE, jain: true };
const nutFree = { ...EMPTY_PROFILE, allergies: ["nuts" as const] };

describe("readProfile", () => {
  it("reads what was saved and nothing else", () => {
    expect(readProfile({ food_profile: { allergies: ["nuts", "bogus"], jain: true, fastingDays: [2, 2, 9, "x", 4] } })).toEqual({
      allergies: ["nuts"],
      jain: true,
      fastingDays: [2, 4],
    });
  });

  it("is empty for an account that never set one, or for rubbish", () => {
    expect(readProfile(undefined)).toEqual(EMPTY_PROFILE);
    expect(readProfile({ food_profile: "yes" })).toEqual(EMPTY_PROFILE);
    expect(readProfile({ food_profile: { jain: "true" } }).jain).toBe(false);
  });
});

describe("Jain", () => {
  it.each(["Onions", "Aloo Gobi", "Garlic", "Baby Carrots", "Spring Onion", "Sweet Potato", "Mushrooms"])("flags %s", (n) => {
    expect(isJainConflict(n)).toBe(true);
  });

  it.each(["Paneer", "Spinach", "Tomatoes", "Cauliflower", "Bhindi (Okra)"])("leaves %s alone", (n) => {
    expect(isJainConflict(n)).toBe(false);
  });

  it("only warns an account that is Jain", () => {
    expect(profileWarnings(jain, "Onions")).toEqual(["Not Jain"]);
    expect(profileWarnings(EMPTY_PROFILE, "Onions")).toEqual([]);
  });
});

describe("allergies", () => {
  it("warns from the ingredient list as well as the name, naming what it found", () => {
    expect(profileWarnings(nutFree, "Cookies", "wheat flour, sugar, almonds")).toEqual(["You avoid: nuts"]);
  });

  it("stays quiet about an allergen the account did not list", () => {
    expect(profileWarnings(nutFree, "Cookies", "wheat flour, milk")).toEqual([]);
  });
});

describe("what to keep out of suggestions", () => {
  it("drops every catalogue dish with a Jain-forbidden ingredient", () => {
    const avoided = dishesToAvoid(jain);
    expect(avoided.length).toBeGreaterThan(0);
    expect(avoided.some((d) => /aloo/i.test(d))).toBe(true);
  });

  it("avoids nothing for a profile with nothing set", () => {
    expect(dishesToAvoid(EMPTY_PROFILE)).toEqual([]);
  });

  it("names what a generated recipe breaks, from its ingredient lines", () => {
    expect(recipeProblems(jain, ["200 g paneer", "2 onions, sliced"])).toHaveLength(1);
    expect(recipeProblems(nutFree, ["100 g cashew nuts"])).toEqual(["nuts"]);
    expect(recipeProblems(jain, ["200 g paneer", "1 tomato"])).toEqual([]);
  });
});
