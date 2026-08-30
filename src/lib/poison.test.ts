import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * The poison test (Task 3b).
 *
 * Every baseline day value is replaced with a unique sentinel, then the whole
 * keyword corpus is re-run. If any lookup still resolves to the right row,
 * the matcher is genuinely keyed on identity. If a lookup breaks, that test
 * was value-coupled — it was passing because of a number, not because the
 * correct row was found.
 *
 * This is the class of failure that hid the "Tomatoes" plural bug: the name
 * fell through to a category default that happened to equal the tomato row's
 * own value, so a day-count assertion passed while the row never matched.
 *
 * Wired as a real test rather than a one-off script so it runs on every
 * `npm test`.
 */

const CORPUS: [string, string][] = [
  ["Onions", "onion"],
  ["Tomatoes", "tomato"],
  ["Potatoes", "potato"],
  ["Basmati Rice 1 kg", "rice"],
  ["Amul Masti Dahi 400ml", "curd"],
  ["Mother Dairy Toned Milk 500ml", "milk"],
  ["Coconut Milk", "coconut-milk"],
  ["Milk Powder", "coconut-milk"],
  ["Peanut Butter", "peanut-butter"],
  ["Garlic Bread", "bread"],
  ["Paneer Masala (MDH)", "masala"],
  ["Palak (Spinach)", "coriander"],
  ["Bhindi (Okra)", "bhindi"],
  ["Eggs 6 pcs", "egg"],
  ["Chicken Breast", "chicken"],
  ["Toor Dal", "dal"],
  ["Frozen Peas", "frozen"],
  ["Mango Pickle", "pickle"],
];

describe("poison test — lookups must not depend on day values", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.resetModules());

  it("resolves every corpus entry to the same row when all day values are poisoned", async () => {
    const clean = await import("@/lib/shelf-life");
    const cleanData = await import("@/lib/shelf-life-data");
    const before = CORPUS.map(([name]) => clean.findShelfLifeRow(name)?.row.id ?? null);

    // Sanity: the corpus must be correct before poisoning, or this proves
    // nothing. A checker that cannot fail is not a checker.
    expect(before).toEqual(CORPUS.map(([, id]) => id));

    // Every row gets a distinct, absurd day value. If any assertion below
    // depended on a real number, it now cannot pass.
    const poisoned = cleanData.SHELF_LIFE_ROWS.map((row, i) => ({ ...row, days: 9000 + i }));
    expect(new Set(poisoned.map((r) => r.days)).size).toBe(poisoned.length);

    vi.doMock("@/lib/shelf-life-data", async () => {
      const actual = await vi.importActual<typeof cleanData>("@/lib/shelf-life-data");
      return {
        ...actual,
        SHELF_LIFE_ROWS: poisoned,
        ROWS_BY_KEY_LENGTH: poisoned
          .flatMap((row) => row.keys.map((key) => ({ key: key.toLowerCase(), row })))
          .sort((a, b) => b.key.length - a.key.length),
      };
    });

    // resetModules AFTER doMock, not before: the clean import above is
    // already cached, and without this the re-import returns it unchanged —
    // which the vacuity guard below caught on the first run.
    vi.resetModules();
    const poisonedModule = await import("@/lib/shelf-life");
    const after = CORPUS.map(([name]) => poisonedModule.findShelfLifeRow(name)?.row.id ?? null);

    // Identity must be unchanged; only the numbers moved.
    expect(after).toEqual(before);

    // And confirm the poisoning actually took effect, so a silently-failing
    // mock cannot make this test vacuous.
    const poisonedDays = poisonedModule.findShelfLifeRow("Onions")!.row.days;
    expect(poisonedDays).toBeGreaterThanOrEqual(9000);
  });
});
