import { describe, expect, it } from "vitest";
import { isLeftover, leftoverName, leftoverPlan } from "./leftovers";
import { getItemDietType } from "./diet";

describe("leftoverPlan", () => {
  it("gives 3 days in the fridge, the low end of USDA's 3 to 4", () => {
    expect(leftoverPlan("fridge", false)).toMatchObject({ ok: true, days: 3 });
  });

  it("gives 90 days frozen, the low end of 3 to 4 months", () => {
    expect(leftoverPlan("freezer", false)).toMatchObject({ ok: true, days: 90 });
  });

  it("says eat it today for food that is still on the counter", () => {
    expect(leftoverPlan("counter", false)).toMatchObject({ ok: true, days: 0 });
  });

  it("refuses food left out for over two hours, whatever it is stored in now", () => {
    for (const where of ["fridge", "freezer", "counter"] as const) {
      expect(leftoverPlan(where, true)).toMatchObject({ ok: false });
    }
  });
});

describe("leftoverName", () => {
  it("adds the prefix once", () => {
    expect(leftoverName("  dal   tadka ")).toBe("Leftover dal tadka");
    expect(leftoverName("Leftover dal")).toBe("Leftover dal");
    expect(leftoverName("leftover rice")).toBe("leftover rice");
  });

  it("is recognised as a leftover, and a name that merely contains the word is not", () => {
    expect(isLeftover("Leftover dal")).toBe(true);
    expect(isLeftover("Leftovers pizza")).toBe(false);
    expect(isLeftover("Dal")).toBe(false);
  });

  it("keeps the diet reading of the dish, so a non-veg leftover is still non-veg", () => {
    expect(getItemDietType(leftoverName("chicken curry"))).toBe("non-veg");
    expect(getItemDietType(leftoverName("dal"))).toBe("veg");
  });
});
