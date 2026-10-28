import { afterEach, describe, expect, it } from "vitest";
import { ASSUMED_STORAGE_C, KITCHEN_COUNTER_C, asKitchenTemp, setKitchenTemp } from "./temperature";
import { estimateShelfLife } from "./shelf-life";

afterEach(() => setKitchenTemp("normal"));

describe("kitchen temperature", () => {
  it("defaults to the 29 °C every figure was built for", () => {
    expect(ASSUMED_STORAGE_C.counter).toBe(29);
  });

  it("moves only the counter, never the fridge or freezer", () => {
    setKitchenTemp("hot");
    expect(ASSUMED_STORAGE_C.counter).toBe(KITCHEN_COUNTER_C.hot);
    expect(ASSUMED_STORAGE_C.fridge).toBe(7);
    expect(ASSUMED_STORAGE_C.freezer).toBe(-18);
  });

  it("treats anything unknown as normal", () => {
    expect(asKitchenTemp("lukewarm")).toBe("normal");
    expect(asKitchenTemp(undefined)).toBe("normal");
    setKitchenTemp("nonsense");
    expect(ASSUMED_STORAGE_C.counter).toBe(29);
  });

  it("a hot kitchen shortens a counter item, a cooler one lengthens it", () => {
    const normal = estimateShelfLife("Bread").days;
    setKitchenTemp("hot");
    const hot = estimateShelfLife("Bread").days;
    setKitchenTemp("cool");
    const cool = estimateShelfLife("Bread").days;
    expect(hot).toBeLessThanOrEqual(normal);
    expect(cool).toBeGreaterThanOrEqual(normal);
  });

  it("leaves a fridge item alone, since the fridge does not follow the room", () => {
    const normal = estimateShelfLife("Paneer").days;
    setKitchenTemp("hot");
    expect(estimateShelfLife("Paneer").days).toBe(normal);
  });
});
