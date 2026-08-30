import { inferItemCategory, type ItemCategory } from "@/lib/item-category";
import {
  ROWS_BY_KEY_LENGTH,
  type Confidence,
  type PerishTier,
  type ShelfLifeRow,
} from "@/lib/shelf-life-data";
import {
  ASSUMED_STORAGE_C,
  STORAGE_DISCLAIMER,
  STORAGE_LABEL,
  adjustDays,
  type StorageLocation,
} from "@/lib/temperature";

/**
 * Estimates how long an item will keep, and says where the number came from.
 *
 * Every unscanned item used to get a flat 30 days. That put palak and
 * basmati rice on the same clock: the spinach showed "Still Good" for four
 * weeks while it rotted, and the rice went "Critical" while sealed in the
 * bag. A tracker whose headline number is wrong in both directions teaches
 * people to ignore it.
 *
 * The estimate is never presented as a fact. Every result carries a
 * `source`, and the UI shows it, so "we read this off the pack" and "we
 * guessed from the category" are visibly different claims — the same reason
 * the allergen badge degrades to "unknown" instead of "safe".
 *
 * Five tiers, in order of how much they can be trusted:
 *
 *   1 scanned   — a real printed date. Used verbatim, never adjusted.
 *   2 database  — a barcode row (Open Food Facts). Hook only for now.
 *   3 known     — a sourced baseline row matched by name.
 *   4 category  — inferred category baseline.
 *   5 fallback  — nothing matched; conservative, rounded down, flagged.
 *
 * Tiers 2–4 get a temperature adjustment from the row's own reference
 * temperature to the storage we assume for an Indian household, and are
 * downgraded one confidence step for it, because an adjusted number is a
 * scenario rather than a measurement.
 */

export type ShelfLifeSource = "scanned" | "database" | "known" | "category" | "fallback";

export interface ShelfLifeEstimate {
  days: number;
  source: ShelfLifeSource;
  /** Short sentence for the UI. Always says how confident this is. */
  explanation: string;
  /** True when a human should be nudged to check it. */
  wantsConfirmation: boolean;

  // ── Added by the sourced-table work; existing callers ignore these ──
  confidence: Confidence;
  /** Where the number came from, verbatim, for the UI and the report. */
  citation: string;
  tier: PerishTier;
  /** Storage this estimate assumes. */
  storage: StorageLocation;
  assumedTempC: number;
  /** The same item kept elsewhere, for the "if stored differently" line. */
  ifStoredDifferently: { fridge: number; counter: number; freezer: number };
  /** Shown wherever an adjusted number appears. */
  disclaimer: string;
}

const CATEGORY_SHELF_LIFE: Record<ItemCategory, { days: number; tier: PerishTier; storage: StorageLocation }> = {
  vegetable: { days: 7, tier: "perishable", storage: "counter" },
  fruit: { days: 7, tier: "perishable", storage: "counter" },
  dairy: { days: 6, tier: "highly-perishable", storage: "fridge" },
  meat: { days: 2, tier: "highly-perishable", storage: "fridge" },
  bakery: { days: 4, tier: "perishable", storage: "counter" },
  grain: { days: 180, tier: "shelf-stable", storage: "counter" },
  beverage: { days: 90, tier: "shelf-stable", storage: "counter" },
  frozen: { days: 90, tier: "shelf-stable", storage: "freezer" },
  snack: { days: 120, tier: "shelf-stable", storage: "counter" },
  pantry: { days: 180, tier: "shelf-stable", storage: "counter" },
  unknown: { days: 14, tier: "perishable", storage: "counter" },
};

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  vegetable: "vegetables", fruit: "fruit", dairy: "dairy", meat: "meat",
  bakery: "bakery items", grain: "grains", beverage: "drinks",
  frozen: "frozen food", snack: "snacks", pantry: "pantry staples",
  unknown: "similar items",
};

// Used when even the category is unknown. 14 rather than 30: an unknown item
// is more likely to be perishable than a sealed dry good, and an early
// warning costs a sniff test while a late one costs the food.
const FALLBACK_DAYS = 14;

const DOWNGRADE: Record<Confidence, Confidence> = { high: "medium", medium: "low", low: "low" };

/**
 * Word-boundary match that still accepts a plural.
 *
 * A plain `onion` does NOT match "Onions", because the trailing "s" is
 * a word character — so every plural item name fell through to the category
 * default. "Tomatoes" was especially deceptive: it returned 7 days, which is
 * also the tomato row's value, so it looked correct while actually missing.
 *
 * The diet classifier's `hasWord` deliberately has no plural rule (its lists
 * spell out "egg" and "eggs" separately), and widening it there would risk
 * the eggplant class of bug, so this is a separate matcher.
 */
const WORD_CHAR = /[a-z0-9]/i;
const matchesTerm = (text: string, term: string): boolean => {
  for (let from = 0; ; ) {
    const at = text.indexOf(term, from);
    if (at === -1) return false;
    let end = at + term.length;
    // Accept a trailing plural, so "onion" matches "Onions" and "tomato"
    // matches "Tomatoes".
    if (text.slice(end, end + 2) === "es") end += 2;
    else if (text[end] === "s") end += 1;
    const before = at === 0 ? "" : text[at - 1];
    const after = text[end] ?? "";
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return true;
    from = at + 1;
  }
};

/**
 * Finds the sourced row for a name, honouring exclusions.
 *
 * Word-boundary matching, not substring: the old `text.includes()` matched
 * "milk" inside "coconut milk" and "garlic" inside "garlic bread", giving a
 * shelf-stable can three days and a loaf of bread thirty.
 */
export function findShelfLifeRow(name: string): { key: string; row: ShelfLifeRow } | null {
  const text = (name || "").toLowerCase();
  if (!text.trim()) return null;

  for (const entry of ROWS_BY_KEY_LENGTH) {
    if (entry.row.exclude?.some((phrase) => text.includes(phrase.toLowerCase()))) continue;
    // Multi-word keys are phrases, so a plain substring test is right for
    // them; single words need the boundary check.
    const matched = entry.key.includes(" ") ? text.includes(entry.key) : matchesTerm(text, entry.key);
    if (matched) return entry;
  }
  return null;
}

const storedElsewhere = (days: number, fromC: number, row?: Pick<ShelfLifeRow, "eaKJ" | "lookupOnly">) => ({
  fridge: Math.max(0, Math.round(adjustDays(days, fromC, ASSUMED_STORAGE_C.fridge, row) * 10) / 10),
  counter: Math.max(0, Math.round(adjustDays(days, fromC, ASSUMED_STORAGE_C.counter, row) * 10) / 10),
  // Freezing is outside both models, so this is the honest answer: we do not
  // extrapolate a microbial rate across a phase change.
  freezer: 0,
});

/**
 * @param name        the item's name as the user will see it
 * @param scannedDays days remaining read from a real printed expiry date,
 *                    when one was scanned. Always wins, never adjusted.
 */
export function estimateShelfLife(name: string, scannedDays?: number | null): ShelfLifeEstimate {
  // ── Tier 1: a real printed date ──────────────────────────────────
  if (typeof scannedDays === "number" && Number.isFinite(scannedDays) && scannedDays >= 0) {
    const days = Math.round(scannedDays);
    return {
      days,
      source: "scanned",
      explanation: "Read from the expiry date printed on the pack.",
      wantsConfirmation: false,
      confidence: "high",
      citation: "Printed on the pack",
      tier: "perishable",
      storage: "counter",
      assumedTempC: ASSUMED_STORAGE_C.counter,
      ifStoredDifferently: { fridge: days, counter: days, freezer: days },
      // A printed date is a manufacturer's statement, not our estimate, so
      // the storage disclaimer would be a false qualifier here.
      disclaimer: "",
    };
  }

  // ── Tier 3: sourced baseline row ─────────────────────────────────
  // (Tier 2, a barcode/database row, is not wired yet — see the roadmap.)
  const hit = findShelfLifeRow(name);
  if (hit) {
    const { row, key } = hit;
    const targetC = ASSUMED_STORAGE_C[row.storage];
    const adjusted = adjustDays(row.days, row.refTempC, targetC, { eaKJ: row.eaKJ, lookupOnly: row.lookupOnly });
    // Round DOWN. Asymmetric harm: an estimate a day short costs one sniff
    // test, a day long costs the food.
    const days = Math.max(1, Math.floor(adjusted));
    const wasAdjusted = row.refTempC !== targetC && !row.lookupOnly;

    return {
      days,
      source: "known",
      explanation: wasAdjusted
        ? `Typical for ${key}, adjusted for ${STORAGE_LABEL[row.storage]} at ${targetC}°C. Change it if your pack says otherwise.`
        : `Typical for ${key}. Change it if your pack says otherwise.`,
      wantsConfirmation: row.confidence === "low",
      confidence: wasAdjusted ? DOWNGRADE[row.confidence] : row.confidence,
      citation: row.source,
      tier: row.tier,
      storage: row.storage,
      assumedTempC: targetC,
      ifStoredDifferently: storedElsewhere(row.days, row.refTempC, row),
      disclaimer: STORAGE_DISCLAIMER,
    };
  }

  // ── Tier 4: inferred category ────────────────────────────────────
  const category = inferItemCategory(name);
  if (category !== "unknown") {
    const base = CATEGORY_SHELF_LIFE[category];
    return {
      days: base.days,
      source: "category",
      explanation: `Estimated from ${CATEGORY_LABEL[category]} — worth checking.`,
      wantsConfirmation: true,
      confidence: "low",
      citation: "Category average, not a sourced figure",
      tier: base.tier,
      storage: base.storage,
      assumedTempC: ASSUMED_STORAGE_C[base.storage],
      ifStoredDifferently: storedElsewhere(base.days, ASSUMED_STORAGE_C[base.storage]),
      disclaimer: STORAGE_DISCLAIMER,
    };
  }

  // ── Tier 5: nothing matched ──────────────────────────────────────
  return {
    days: FALLBACK_DAYS,
    source: "fallback",
    explanation: "We could not tell what this is, so this is a guess. Please set it yourself.",
    wantsConfirmation: true,
    confidence: "low",
    citation: "No match — conservative default",
    tier: "perishable",
    storage: "counter",
    assumedTempC: ASSUMED_STORAGE_C.counter,
    ifStoredDifferently: storedElsewhere(FALLBACK_DAYS, ASSUMED_STORAGE_C.counter),
    disclaimer: STORAGE_DISCLAIMER,
  };
}

export const SHELF_LIFE_SOURCE_LABEL: Record<ShelfLifeSource, string> = {
  scanned: "From the pack",
  database: "From the product database",
  known: "Typical shelf life",
  category: "Estimated",
  fallback: "Guessed",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Sourced",
  medium: "Estimated",
  low: "Rough guess",
};
