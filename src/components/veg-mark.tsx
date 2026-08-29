import type { ItemDietType } from "@/lib/diet";

/**
 * The mark printed on every packaged food sold in India: a green filled
 * circle in a green square for vegetarian, a brown filled triangle in a
 * brown square for non-vegetarian. Mandated by the Food Safety and
 * Standards (Packaging and Labelling) Regulations, so every Indian shopper
 * already reads it without being taught.
 *
 * This is why it earns space that a text chip does not. "Not Vegetarian" is
 * a sentence you have to read; the mark is recognised at a glance, at the
 * size of a fingernail, in a language-independent way.
 *
 * There is no official mark for egg. The convention that has settled in
 * practice is the same square with a yellow-brown dot, so that is what is
 * used, and it is always paired with a text label rather than left to
 * stand alone.
 */

const TONE: Record<ItemDietType, { stroke: string; fill: string; label: string }> = {
  veg: { stroke: "#1a7f3c", fill: "#1a7f3c", label: "Vegetarian" },
  egg: { stroke: "#b4690e", fill: "#d98a1f", label: "Contains egg" },
  "non-veg": { stroke: "#8f1d1d", fill: "#8f1d1d", label: "Non-vegetarian" },
};

interface VegMarkProps {
  diet: ItemDietType;
  size?: number;
  /** When the classification came from a name only, not an ingredient list. */
  unverified?: boolean;
  className?: string;
}

export function VegMark({ diet, size = 14, unverified = false, className = "" }: VegMarkProps) {
  const tone = TONE[diet];
  const title = unverified ? `${tone.label} — from the name only, not checked against ingredients` : tone.label;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role="img"
      aria-label={title}
      className={`shrink-0 ${className}`}
    >
      <title>{title}</title>
      <rect
        x="1.5"
        y="1.5"
        width="17"
        height="17"
        rx="2.5"
        fill="none"
        stroke={tone.stroke}
        strokeWidth="2"
        // A dashed border is the honest way to show "this is our reading of
        // the name, not a verified label" without inventing a new symbol.
        strokeDasharray={unverified ? "3 2" : undefined}
      />
      {diet === "non-veg" ? (
        <path d="M10 5.2 L15 14.2 H5 Z" fill={tone.fill} />
      ) : (
        <circle cx="10" cy="10" r="4.6" fill={tone.fill} />
      )}
    </svg>
  );
}
