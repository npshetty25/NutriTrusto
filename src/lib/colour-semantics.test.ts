import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  dietChipClasses,
  isGreenToken,
  positiveFindingClasses,
  riskClasses,
  confidenceClasses,
} from "@/lib/colour-semantics";
import { riskLabelForDays } from "@/lib/risk-bands";
import type { RiskLevel } from "@/lib/risk-bands";

describe("no green on anything non-veg", () => {
  it("the diet chip is never green for a non-veg item", () => {
    for (const conflict of [true, false]) {
      expect(isGreenToken(dietChipClasses("non-veg", conflict))).toBe(false);
    }
  });

  it("positive nutrition findings are not green on a non-veg product", () => {
    const c = positiveFindingClasses("non-veg");
    for (const cls of Object.values(c)) expect(isGreenToken(cls)).toBe(false);
  });

  it("still uses green where it is correct — a vegetarian item", () => {
    expect(isGreenToken(dietChipClasses("veg", false))).toBe(true);
  });

  it("egg is amber, neither green nor red", () => {
    const c = dietChipClasses("egg", false);
    expect(isGreenToken(c)).toBe(false);
    expect(c).toContain("warning");
  });

  it("no raw green-500/600/700 remains in the scanned-product sheet", () => {
    const src = readFileSync("src/app/page.tsx", "utf8");
    const raw = src.match(/(bg|text|border)-green-\d{3}/g) ?? [];
    expect(raw).toEqual([]);
  });
});

describe("colour is never the sole carrier of meaning (WCAG 1.4.1)", () => {
  it("every risk state renders a text label", () => {
    const states: RiskLevel[] = ["high", "medium", "low"];
    for (const s of states) {
      const { text, bar } = riskClasses(s);
      expect(text).toBeTruthy();
      expect(bar).toBeTruthy();
    }
    // The label is derived from days, and must be non-empty at every point.
    for (const d of [0, 1, 2, 3, 5, 7, 20, 30, 100, 400]) {
      expect(riskLabelForDays(d).length).toBeGreaterThan(0);
    }
  });

  it("distinct day counts produce distinct advice, not one generic string", () => {
    const labels = new Set([0, 1, 2, 5, 20, 400].map(riskLabelForDays));
    expect(labels.size).toBeGreaterThanOrEqual(5);
  });
});

describe("the three axes stay separate", () => {
  it("confidence carries no chromatic token", () => {
    for (const c of ["high", "medium", "low"] as const) {
      const cls = confidenceClasses(c);
      expect(isGreenToken(cls)).toBe(false);
      expect(cls).not.toMatch(/danger|warning|safe/);
    }
  });
});

describe("the FSSAI mark shape is reserved", () => {
  const src = readFileSync("src/components/veg-mark.tsx", "utf8");

  it("uses a circle exactly once — the vegetarian mark only", () => {
    // A filled circle inside a square outline is the vegetarian mark. It
    // must not be reused for anything else, including egg, for which we do
    // NOT assert whether an official mark exists. See the TODO in the file.
    const circles = src.match(/<circle/g) ?? [];
    expect(circles).toHaveLength(1);
  });

  it("records the open question rather than claiming an answer", () => {
    expect(src).toMatch(/TODO/);
    expect(src).toMatch(/Packaging and Labelling/i);
  });

  it("egg does not use the circle-in-square shape", () => {
    // The egg branch must render something other than <circle>.
    const eggUsesCircle = /diet === "egg"[\s\S]{0,120}?<circle/.test(src);
    expect(eggUsesCircle).toBe(false);
  });
});
