import { describe, expect, it } from "vitest";
import { estimateShelfLife, findShelfLifeRow, formatProvenance } from "@/lib/shelf-life";
import { SHELF_LIFE_ROWS } from "@/lib/shelf-life-data";
import { ASSUMED_STORAGE_C, adjustDays } from "@/lib/temperature";
import { inferItemCategory } from "@/lib/item-category";

/**
 * Every lookup assertion here checks the MATCHED ROW ID, never the day count
 * alone.
 *
 * The bug that motivates the rule: a word-boundary regex failed to match
 * "Onions", and "Tomatoes" fell through to a category default that happened
 * to equal the tomato row's own value. A day-count assertion passed while the
 * correct row was never matched. Any test that asserts on the number instead
 * of the identity will hide the next instance.
 */

const rowIdFor = (name: string) => findShelfLifeRow(name)?.row.id ?? null;

describe("row identity — every lookup asserts on matched_row_id", () => {
  it("gives every row a unique, stable id", () => {
    const ids = SHELF_LIFE_ROWS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
  });

  it("does not derive ids from keys[0]", () => {
    // Ids used to be generated as keys[0].replace(...), which meant renaming
    // or reordering a key silently renumbered the row — a test pinned to an
    // id could start passing against a different row. These three rows are
    // deliberately named for what they cover rather than their first key, so
    // a revert to the derivation fails here instead of going unnoticed.
    const derived = (row: { keys: string[] }) =>
      row.keys[0].toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const byId = (id: string) => SHELF_LIFE_ROWS.find((r) => r.id === id)!;

    for (const [id, firstKey] of [
      ["plant-milk-and-powder", "coconut milk"],
      ["leafy-herbs", "coriander"],
      ["ground-spices", "masala"],
    ] as const) {
      const row = byId(id);
      expect(row).toBeDefined();
      expect(row.keys[0]).toBe(firstKey);
      expect(derived(row)).not.toBe(row.id);
    }
  });

  it.each([
    ["Palak (Spinach)", "leafy-herbs"],
    ["Basmati Rice", "rice"],
    ["Toor Dal", "dal"],
    ["Amul Butter", "butter"],
    ["Mango Pickle", "pickle"],
    ["Frozen Peas", "frozen"],
  ])("%s resolves to row %s", (name, expectedId) => {
    expect(rowIdFor(name)).toBe(expectedId);
  });
});

describe("false-friend regressions (all seven, tier 3)", () => {
  it.each([
    ["Coconut Milk (canned)", "milk"],
    ["Milk Powder", "milk"],
    ["Almond Milk (UHT)", "milk"],
    ["Soya Milk", "milk"],
    ["Paneer Masala (MDH)", "paneer"],
    ["Peanut Butter", "butter"],
    ["Garlic Bread", "garlic"],
  ])("%s must NOT match the perishable row %s", (name, forbiddenId) => {
    expect(rowIdFor(name)).not.toBe(forbiddenId);
  });

  it("Goat Milk is dairy, not a shelf-stable plant milk", () => {
    // The worst matcher failure this project has had. Two independent raw
    // `includes` calls compounded: the key "oat milk" matched inside "goat
    // milk", AND the dairy row's own exclusion "oat milk" fired on it too, so
    // the correct row removed itself from consideration. Result: 365 days for
    // fresh milk, ~90x too long and in the unsafe direction. Every other
    // matcher bug found here failed by MISSING a match and degrading to a
    // conservative default; this one made a confident wrong match.
    expect(rowIdFor("Goat Milk")).toBe("milk");
    expect(estimateShelfLife("Goat Milk").days).toBeLessThanOrEqual(7);
  });

  it.each([
    // Same mechanism, same row. Each was 365 days.
    ["Goat Milk Powder", "plant-milk-and-powder"],
    ["Milk Powdered Drink", "milk"],
  ])("%s resolves to %s", (name, id) => {
    expect(rowIdFor(name)).toBe(id);
  });

  it.each(["Coconut Milkshake", "Almond Milkshake", "Condensed Milky Bar"])(
    "%s is not treated as a sealed shelf-stable carton",
    (name) => {
      // A milkshake is perishable. These matched the plant-milk row's keys as
      // bare substrings and were handed 365 days; they now fall through to the
      // conservative no-match default instead of a confidently wrong number.
      expect(rowIdFor(name)).not.toBe("plant-milk-and-powder");
      expect(estimateShelfLife(name).days).toBeLessThanOrEqual(14);
    }
  );

  it.each([
    // Single-word keys hiding inside longer food words. These never actually
    // misfired — matchesTerm has always rejected them — but they are the class
    // the multi-word branch bypassed, so they are pinned here explicitly.
    "Graham Crackers", "Liquorice", "Sandalwood Soap", "Oatmeal", "Wheatgrass",
  ])("%s matches no row on a word fragment", (name) => {
    expect(rowIdFor(name)).toBeNull();
  });

  it("Garlic Bread resolves to bread, not garlic", () => {
    expect(rowIdFor("Garlic Bread")).toBe("bread");
  });

  it("plant milks and milk powder resolve to the shelf-stable row", () => {
    for (const n of ["Coconut Milk", "Milk Powder", "Almond Milk", "Soya Milk"]) {
      expect(rowIdFor(n)).toBe("plant-milk-and-powder");
    }
  });
});

describe("false-friend regressions run through tier 4 as well", () => {
  // inferItemCategory used bare includes() with no boundaries and no
  // exclusions, so the fallback path carried the identical defect that was
  // fixed at tier 3. These assert the category matcher, not the row matcher.
  it.each([
    ["Coconut Milk", "dairy"],
    ["Milk Powder", "dairy"],
    ["Almond Milk", "dairy"],
    ["Soya Milk", "dairy"],
    ["Paneer Masala", "dairy"],
    ["Peanut Butter", "dairy"],
  ])("%s must not be categorised as %s", (name, forbidden) => {
    expect(inferItemCategory(name)).not.toBe(forbidden);
  });

  it("Garlic Bread categorises as bakery, not vegetable", () => {
    expect(inferItemCategory("Garlic Bread")).toBe("bakery");
  });

  it("Ice Cream categorises as frozen, not dairy", () => {
    expect(inferItemCategory("Ice Cream")).toBe("frozen");
  });
});

describe("morphology corpus — both matchers", () => {
  const CORPUS: [string, string][] = [
    // plurals and irregulars
    ["onion", "onion"], ["Onions", "onion"],
    ["tomato", "tomato"], ["Tomatoes", "tomato"],
    ["potato", "potato"], ["Potatoes", "potato"],
    ["mango", "mango"], ["Mangoes", "mango"],
    ["banana", "banana"], ["Bananas", "banana"],
    ["carrot", "carrot"], ["Carrots", "carrot"],
    ["mushroom", "mushroom"], ["Mushrooms", "mushroom"],
    // transliteration variants
    ["dahi", "curd"], ["curd", "curd"], ["Yoghurt", "curd"], ["yogurt", "curd"],
    ["atta", "atta"], ["wheat flour", "atta"],
    ["bhindi", "bhindi"], ["okra", "bhindi"], ["lady finger", "bhindi"],
    ["paneer", "paneer"], ["cottage cheese", "paneer"],
    ["palak", "leafy-herbs"], ["spinach", "leafy-herbs"],
    ["jeera", "ground-spices"], ["cumin", "ground-spices"],
    ["haldi", "ground-spices"], ["turmeric", "ground-spices"],
    // casing, whitespace, brand prefixes, quantity suffixes
    ["AMUL MASTI DAHI", "curd"],
    ["  Amul   Masti Dahi 400ml  ", "curd"],
    ["Mother Dairy Toned Milk 500ml", "milk"],
    ["Basmati Rice 1 kg", "rice"],
    ["Eggs 6 pcs", "egg"],
    ["Tata Salt 1kg", "salt"],
  ];

  it.each(CORPUS)("%s resolves to row %s", (input, expectedId) => {
    expect(rowIdFor(input)).toBe(expectedId);
  });

  it("never returns a row for an empty or whitespace name", () => {
    for (const n of ["", "   ", "\t"]) expect(findShelfLifeRow(n)).toBeNull();
  });
});

describe("tier 5 fallback actually fires", () => {
  it.each(["Zorblax Wibbleflum", "qqqq zzzz", "Xyzzy Plugh 900"])(
    "%s falls through to the conservative default",
    (name) => {
      expect(findShelfLifeRow(name)).toBeNull();
      const e = estimateShelfLife(name);
      expect(e.source).toBe("fallback");
      expect(e.confidence).toBe("low");
      expect(e.wantsConfirmation).toBe(true);
    }
  );
});

describe("chilling injury — colder must never look longer", () => {
  const chillingRows = SHELF_LIFE_ROWS.filter((r) => r.chilling_sensitive);

  it("flags a meaningful number of rows", () => {
    expect(chillingRows.length).toBeGreaterThanOrEqual(10);
  });

  it.each(chillingRows.map((r) => [r.id] as const))(
    "%s never reports a longer life in the fridge than at ambient",
    (id) => {
      const row = SHELF_LIFE_ROWS.find((r) => r.id === id)!;
      const e = estimateShelfLife(row.keys[0]);
      const { fridge, counter } = e.ifStoredDifferently;
      if (fridge === null) return; // declined to advise — acceptable
      expect(fridge).toBeLessThanOrEqual(counter);
    }
  );

  it("every chilling threshold is now sourced to Handbook 66", () => {
    for (const row of chillingRows) {
      const c = row.chilling_sensitive!;
      expect(c.min_safe_temp_c).not.toBeNull();
      expect(c.source).toMatch(/Handbook 66/);
      expect(c.confidence).toBe("high");
    }
  });

  it("gives a reason whenever the fridge figure is withheld or capped", () => {
    for (const row of chillingRows) {
      const e = estimateShelfLife(row.keys[0]);
      const { fridge, counter, suppressedReason } = e.ifStoredDifferently;
      // Either we decline, or we cap at ambient — never an extension.
      if (fridge === null || fridge <= counter) {
        expect(suppressedReason).toBeTruthy();
      }
    }
  });

  it("banana no longer claims weeks in the fridge", () => {
    // 56.1 days before the guard. Its threshold is 13 °C (AH-66) and our
    // fridge is 7 °C, so refrigeration is capped at the ambient figure and
    // the injury is named rather than a longer life implied.
    const e = estimateShelfLife("Banana");
    const { fridge, counter, suppressedReason } = e.ifStoredDifferently;
    expect(fridge).not.toBeNull();
    expect(fridge!).toBeLessThanOrEqual(counter);
    expect(suppressedReason).toMatch(/dull colour/i);
  });

  it("potato is not saved by the chilling guard alone", () => {
    // Its threshold is 3 °C, BELOW our 7 °C fridge, so the chilling guard
    // correctly lets it through. Q10 then returned 314 days. The
    // extrapolation cap is what stops it.
    const e = estimateShelfLife("Potato");
    expect(e.ifStoredDifferently.fridge).toBeNull();
    expect(e.ifStoredDifferently.suppressedReason).toMatch(/outside the model/i);
  });

  it("a published Ea may be carried further than the generic Q10 fallback", () => {
    // Milk's Ea was fitted across a real range, so its counter figure is
    // allowed; potato is on the rule-of-thumb fallback and is not.
    expect(estimateShelfLife("Milk").ifStoredDifferently.fridge).not.toBeNull();
    expect(estimateShelfLife("Potato").ifStoredDifferently.fridge).toBeNull();
  });
});

describe("bread bypasses the temperature model", () => {
  it("is marked non-microbial and lookup-only", () => {
    const row = findShelfLifeRow("Bread")!.row;
    expect(row.degradation_mode).toBe("starch_retrogradation");
    expect(row.lookupOnly).toBe(true);
    expect(row.eaKJ).toBeUndefined();
  });

  it("never routes through Arrhenius or Q10", () => {
    const row = findShelfLifeRow("Bread")!.row;
    // lookupOnly forces the multiplier to exactly 1 in both directions.
    expect(adjustDays(row.days, row.refTempC, ASSUMED_STORAGE_C.fridge, row)).toBe(row.days);
    expect(adjustDays(row.days, row.refTempC, ASSUMED_STORAGE_C.freezer, row)).toBe(row.days);
  });
});

describe("citation lint", () => {
  const RESOLVABLE = /(doi:|10\.\d{4}|isbn|https?:\/\/|USDA|FSIS|FAO|FoodKeeper|ARCC|Food Microbiology)/i;

  it("no row claims high confidence without a resolvable source identifier", () => {
    const offenders = SHELF_LIFE_ROWS.filter(
      (r) => r.confidence === "high" && !RESOLVABLE.test(r.source)
    ).map((r) => `${r.id}: ${r.source}`);
    expect(offenders).toEqual([]);
  });

  it("no row has a TODO source at anything above low confidence", () => {
    const offenders = SHELF_LIFE_ROWS.filter(
      (r) => /^TODO$/i.test(r.source.trim()) && r.confidence !== "low"
    ).map((r) => r.id);
    expect(offenders).toEqual([]);
  });

  it("unsourced chilling thresholds are TODO and low confidence", () => {
    for (const r of SHELF_LIFE_ROWS.filter((x) => x.chilling_sensitive)) {
      const c = r.chilling_sensitive!;
      if (c.min_safe_temp_c === null) {
        expect(c.source).toBe("TODO");
        expect(c.confidence).toBe("low");
      }
      expect(c.injury_mode.length).toBeGreaterThan(0);
    }
  });

  it("the milk anchor is demoted and carries its caveat", () => {
    const milk = SHELF_LIFE_ROWS.find((r) => r.id === "milk")!;
    expect(milk.confidence).toBe("low");
    expect(milk.source_caveat).toMatch(/Emerging Investigators/i);
  });

  it("the milk caveat is visible in the rendered provenance, not just stored", () => {
    const e = estimateShelfLife("Milk");
    expect(formatProvenance(e)).toMatch(/Emerging Investigators/i);
  });

  it("the poultry Ea is stated as a proxy, not as general poultry", () => {
    const chicken = SHELF_LIFE_ROWS.find((r) => r.id === "chicken")!;
    expect(chicken.source).toMatch(/proxy/i);
    expect(chicken.extrapolation_warning).toBeTruthy();
    expect(chicken.confidence).not.toBe("high");
  });
});

describe("data hygiene", () => {
  it("every row carries data_version and effective_date", () => {
    for (const r of SHELF_LIFE_ROWS) {
      expect(r.data_version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.effective_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("downgrades confidence one step after a temperature adjustment", () => {
    // Curd is quoted at 4 °C and stored at 7 °C, so it is adjusted.
    const row = SHELF_LIFE_ROWS.find((r) => r.id === "curd")!;
    expect(row.refTempC).not.toBe(ASSUMED_STORAGE_C[row.storage]);
    expect(row.confidence).toBe("medium");
    expect(estimateShelfLife("Curd").confidence).toBe("low");
  });

  it("does not downgrade when no adjustment was applied", () => {
    const row = SHELF_LIFE_ROWS.find((r) => r.id === "rice")!;
    expect(row.refTempC).toBe(ASSUMED_STORAGE_C[row.storage]);
    expect(estimateShelfLife("Basmati Rice").confidence).toBe(row.confidence);
  });

  it("rounds down, never up", () => {
    for (const name of ["Milk", "Curd", "Paneer", "Chicken", "Egg"]) {
      const e = estimateShelfLife(name);
      expect(Number.isInteger(e.days)).toBe(true);
      const row = findShelfLifeRow(name)!.row;
      const raw = adjustDays(row.days, row.refTempC, ASSUMED_STORAGE_C[row.storage], row);
      expect(e.days).toBeLessThanOrEqual(Math.max(1, raw));
    }
  });

  it("a scanned date is used verbatim and never temperature-adjusted", () => {
    const e = estimateShelfLife("Milk", 9);
    expect(e.days).toBe(9);
    expect(e.source).toBe("scanned");
    expect(e.disclaimer).toBe("");
  });
});
