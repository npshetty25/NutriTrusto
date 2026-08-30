/**
 * Temperature adjustment for shelf-life estimates.
 *
 * Deliverable 3 of the shelf-life research. Two models:
 *
 *   Arrhenius, where a published activation energy exists for that food's
 *   dominant spoilage mechanism (milk, chicken, fish).
 *
 *   Q10, everywhere else. Q10 = 3 is the default, NOT the popular "shelf
 *   life halves every 10 °C" (Q10 = 2). Milk's measured Ea of 66.7 kJ/mol
 *   corresponds to Q10 ≈ 2.5, so Q10 = 2 under-predicts spoilage for dairy —
 *   it errs towards telling someone food is still good. In a 25–35 °C
 *   climate with power cuts that is the wrong direction to be wrong in.
 *
 * IMPORTANT — this converts BETWEEN two temperatures. It is only ever
 * applied from a baseline row's own `refTempC` to the storage temperature we
 * assume. A number already quoted at Indian counter conditions must not be
 * converted again: re-applying a 4 °C→29 °C step to a counter-quoted 4-day
 * spinach figure gives 0.26 days (~6 hours), which is nonsense. Per-row
 * reference temperatures are what prevent that.
 */

/** J·mol⁻¹·K⁻¹ */
const R = 8.314;

/**
 * Assumed storage temperatures for an Indian household — deliberately not
 * the USDA/FoodKeeper 4 °C fridge assumption.
 *
 * 7 °C rather than 4 °C: Indian domestic refrigerators run warmer in
 * practice, are opened often in heat, and lose the cold chain entirely
 * during power cuts. FSSAI's own cold-holding guidance is ≤5 °C rather than
 * the USDA's 4 °C, and real household interiors sit above both.
 *
 * 29 °C for counter and pantry: typical Indian ambient is 25–35 °C.
 */
export const ASSUMED_STORAGE_C = {
  fridge: 7,
  counter: 29,
  freezer: -18,
} as const;

export type StorageLocation = keyof typeof ASSUMED_STORAGE_C;

export const STORAGE_LABEL: Record<StorageLocation, string> = {
  fridge: "in the fridge",
  counter: "on the shelf",
  freezer: "in the freezer",
};

/** Shown wherever an adjusted number is displayed. */
export const STORAGE_DISCLAIMER = "Estimates based on typical Indian storage conditions";

export interface AdjustOptions {
  /** Published activation energy, kJ/mol. Omit to use the Q10 fallback. */
  eaKJ?: number;
  /**
   * Set when the row's spoilage is not a single temperature-driven microbial
   * mechanism — frozen goods, oils and ghee (rancidity), honey, salt. The
   * model is skipped entirely rather than applied badly.
   */
  lookupOnly?: boolean;
}

/**
 * Multiplier to convert a shelf life quoted at `fromC` into one at `toC`.
 * Returns 1 when no conversion is warranted.
 */
export function temperatureMultiplier(fromC: number, toC: number, opts: AdjustOptions = {}): number {
  if (opts.lookupOnly) return 1;
  if (fromC === toC) return 1;

  // Below freezing the dominant mechanism changes completely (phase change,
  // freeze concentration), so neither model holds. The report is explicit
  // that Arrhenius must not be extrapolated across freezing.
  if (toC <= 0 || fromC <= 0) return 1;

  if (typeof opts.eaKJ === "number" && Number.isFinite(opts.eaKJ)) {
    return Math.exp(((opts.eaKJ * 1000) / R) * (1 / (toC + 273.15) - 1 / (fromC + 273.15)));
  }

  return Math.pow(3, (fromC - toC) / 10);
}

/** Convenience wrapper: days at `fromC` → days at `toC`, never negative. */
export function adjustDays(days: number, fromC: number, toC: number, opts: AdjustOptions = {}): number {
  return Math.max(0, days * temperatureMultiplier(fromC, toC, opts));
}
