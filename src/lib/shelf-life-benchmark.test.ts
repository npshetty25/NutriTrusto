import { describe, expect, it } from "vitest";
import { BENCHMARK_ITEMS, coverageTier, measureCoverage } from "./shelf-life-benchmark";

/**
 * Coverage floor for the shelf-life estimate on a fixed list of 107 items an
 * Indian household actually buys. Measured on 2026-10-24: before the USDA
 * FoodKeeper import 83.2% sourced, 4.7% category average, 12.1% fallback;
 * after it 87.9% sourced, 1.9% category, 10.3% fallback. On 2026-10-27, with
 * sourced rows for chikoo, drumsticks and gulab jamun and Indian names for
 * three USDA products (green chillies, cornflakes, soya chunks): 93.5%
 * sourced, 1.9% category, 4.7% fallback. What is left (rusk, jaggery,
 * Bournvita, soan papdi, jalebi) has no source we could verify, and is mostly
 * packaged with a printed date.
 *
 * These are floors, not targets: a change that makes fewer items sourced, or
 * more fall through to the blind 14-day fallback, fails here. Raise them when
 * coverage improves — never lower them to make a change pass.
 */
const SOURCED_FLOOR = 93.4;
const FALLBACK_CEILING = 4.8;

describe("shelf-life coverage benchmark", () => {
  const m = measureCoverage();

  it("has no duplicate items in the benchmark list", () => {
    expect(new Set(BENCHMARK_ITEMS.map((n) => n.toLowerCase())).size).toBe(BENCHMARK_ITEMS.length);
  });

  it(`gives a sourced figure to at least ${SOURCED_FLOOR}% of the list`, () => {
    expect(m.sourced, `sourced ${m.sourced}%`).toBeGreaterThanOrEqual(SOURCED_FLOOR);
  });

  it(`leaves at most ${FALLBACK_CEILING}% to the blind fallback`, () => {
    expect(m.fallback, `fallback ${m.fallback}% — ${m.byTier.fallback.join(", ")}`).toBeLessThanOrEqual(FALLBACK_CEILING);
  });

  it("keeps the Indian sweets FSSAI lists on a sourced figure", () => {
    for (const sweet of ["Rasgulla", "Kaju Katli", "Besan Laddoo", "Peda"]) {
      expect(coverageTier(sweet), sweet).toBe("sourced");
    }
  });
});
