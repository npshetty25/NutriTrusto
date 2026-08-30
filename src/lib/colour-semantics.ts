import type { ItemDietType } from "@/lib/diet";
import type { RiskLevel } from "@/lib/risk-bands";
import type { Confidence } from "@/lib/shelf-life-data";

/**
 * Three independent meanings were sharing one palette.
 *
 * A "Non-Veg" chip rendered green with a tick. In India the green filled
 * circle in a green square is the mandated packaging mark for vegetarian
 * food, so that did not merely confuse — it collided with a regulatory
 * symbol. It was caught by eye, not by a test, which is the reason this
 * module and its tests exist.
 *
 * The three axes, kept apart deliberately:
 *
 *   DIET      what the food is            green / amber / maroon
 *   RISK      how soon it must be eaten   safe / warning / danger tokens
 *   CONFIDENCE how much to trust a number  neutral only, never chromatic
 *
 * Confidence is deliberately colourless. A third chromatic axis on the same
 * card would make none of them readable, and "how sure are we" is not an
 * urgency.
 */

/** Tokens that read as green to a user. Nothing non-veg may use one. */
export const GREEN_FAMILY = [
  "bg-safe", "text-safe", "border-safe",
  "bg-safe/15", "bg-safe/20", "text-safe-strong",
  "green-400", "green-500", "green-600", "green-700",
] as const;

export const isGreenToken = (className: string): boolean =>
  GREEN_FAMILY.some((token) => className.includes(token));

/**
 * Chip colours for what an item IS.
 *
 * Non-veg is neutral grey, not red: for someone who eats meat it is not a
 * warning, it is a fact. Red is reserved for a genuine conflict with the
 * user's stated preference.
 */
export function dietChipClasses(itemDiet: ItemDietType, conflictsWithUserDiet: boolean): string {
  if (conflictsWithUserDiet) return "bg-danger/15 text-danger-strong";
  if (itemDiet === "non-veg") return "bg-foreground/8 text-foreground/70";
  if (itemDiet === "egg") return "bg-warning/15 text-warning-strong";
  return "bg-safe/15 text-safe-strong";
}

/**
 * Colours for how soon an item must be eaten.
 *
 * Never the sole carrier of meaning: every risk state also renders a text
 * label (WCAG 1.4.1). See `riskLabelForDays`.
 */
export function riskClasses(risk: RiskLevel): { text: string; bar: string } {
  if (risk === "high") return { text: "text-danger-strong", bar: "bg-danger" };
  if (risk === "medium") return { text: "text-warning-strong", bar: "bg-warning" };
  return { text: "text-safe-strong", bar: "bg-safe" };
}

/**
 * Confidence is textual. The parameter is accepted so callers read naturally
 * and so a future change has one place to land, but every level returns the
 * same neutral class — deliberately. A third chromatic axis on the same card
 * would make none of the three readable.
 */
export function confidenceClasses(confidence: Confidence): string {
  void confidence;
  return "text-foreground/50";
}

/**
 * Positive nutrition findings on a scanned product.
 *
 * This was raw green-500/600/700, applied regardless of what the product
 * was — the second instance of the same defect as the diet chip, colouring
 * a non-veg product's card green. Gated on diet status and routed through
 * tokens.
 */
export function positiveFindingClasses(itemDiet: ItemDietType): {
  container: string;
  icon: string;
  title: string;
  badge: string;
} {
  if (itemDiet === "non-veg") {
    return {
      container: "bg-foreground/5 border-border",
      icon: "text-foreground/60",
      title: "text-foreground",
      badge: "bg-foreground/10 text-foreground/70",
    };
  }
  return {
    container: "bg-safe/5 border-safe/20",
    icon: "text-safe-strong",
    title: "text-safe-strong",
    badge: "bg-safe/15 text-safe-strong",
  };
}
