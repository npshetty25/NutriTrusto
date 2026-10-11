import { describe, expect, it } from "vitest";
import { isExcluded, isPluralNoun, matchesTerm } from "@/lib/text-match";

describe("matchesTerm", () => {
  it("matches a whole word", () => {
    expect(matchesTerm("full cream milk 500ml", "milk")).toBe(true);
  });

  it("matches an s or es plural", () => {
    expect(matchesTerm("onions 1kg", "onion")).toBe(true);
    expect(matchesTerm("tomatoes", "tomato")).toBe(true);
    expect(matchesTerm("sweet potatoes", "potato")).toBe(true);
  });

  it("does not match inside a longer word", () => {
    expect(matchesTerm("buttermilk", "butter")).toBe(false);
    expect(matchesTerm("eggplant", "egg")).toBe(false);
    expect(matchesTerm("tamatar", "matar")).toBe(false);
  });

  it("respects the boundary at the front of a multi-word term", () => {
    // "goat milk" contains the characters "oat milk"; it must not be read as oat milk.
    expect(matchesTerm("goat milk", "oat milk")).toBe(false);
    expect(matchesTerm("oat milk 1l", "oat milk")).toBe(true);
  });

  it("finds a later occurrence when an earlier one is a fragment", () => {
    expect(matchesTerm("buttermilk with butter", "butter")).toBe(true);
  });

  it("does not match when the term is absent", () => {
    expect(matchesTerm("paneer", "milk")).toBe(false);
  });

  // KNOWN GAP, pinned. The matcher extends by "s"/"es" only, so a y -> ies
  // plural is missed ("pastries" never reaches the "pastry" shelf-life row).
  // Widening the matcher moves shelf-life numbers, so it is a recorded change
  // for the owner (see CHANGELOG.md's rules), not something to slip in with a
  // test. Remove the marker when it is fixed.
  it.fails("matches a y -> ies plural", () => {
    expect(matchesTerm("pastries", "pastry")).toBe(true);
  });
});

describe("isExcluded", () => {
  it("is false when there are no phrases", () => {
    expect(isExcluded("coconut milk", undefined)).toBe(false);
    expect(isExcluded("coconut milk", [])).toBe(false);
  });

  it("matches a phrase as a whole term, in any case in the phrase list", () => {
    expect(isExcluded("coconut milk 200ml", ["Coconut Milk"])).toBe(true);
  });

  it("does not fire on a fragment (the goat milk / oat milk defect)", () => {
    expect(isExcluded("goat milk", ["oat milk"])).toBe(false);
  });
});

describe("isPluralNoun", () => {
  it.each(["Eggs", "Tomatoes", "Sweet Potatoes", "Almonds"])("%s is plural", (name) => {
    expect(isPluralNoun(name)).toBe(true);
  });

  it.each(["Chicken Breast", "Milk", "Paneer", "Rice"])("%s is not plural", (name) => {
    expect(isPluralNoun(name)).toBe(false);
  });

  it.each(["Sea Bass", "Octopus", "Hummus", "Citrus"])("%s ends in s but is singular", (name) => {
    expect(isPluralNoun(name)).toBe(false);
  });

  it("judges the head noun, not the first word", () => {
    expect(isPluralNoun("Egg Noodles")).toBe(true);
    expect(isPluralNoun("Noodles Pack")).toBe(false);
  });

  it("ignores punctuation and surrounding space around the head word", () => {
    expect(isPluralNoun("  Peas, ")).toBe(true);
    expect(isPluralNoun("Frozen Peas!")).toBe(true);
  });
});
