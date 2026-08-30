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
 * TODO — verify against the Food Safety and Standards (Packaging and
 * Labelling) Regulations whether an official egg mark exists, before any
 * report or UI copy claims one way or the other. We do not currently know,
 * and the code should not imply that we do.
 *
 * Until then egg does NOT reuse the circle-in-square shape: that form is the
 * vegetarian mark, and borrowing it for a different meaning is the same
 * class of error as the green non-veg chip. Egg gets a distinct diamond,
 * always paired with a text label rather than left to stand alone.
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
        // Filled triangle — the non-vegetarian mark.
        <path d="M10 5.2 L15 14.2 H5 Z" fill={tone.fill} />
      ) : diet === "egg" ? (
        // Diamond. Deliberately NOT a circle: the circle-in-square is the
        // vegetarian mark and is reserved for it.
        <path d="M10 4.8 L15.2 10 L10 15.2 L4.8 10 Z" fill={tone.fill} />
      ) : (
        // Filled circle — the vegetarian mark.
        <circle cx="10" cy="10" r="4.6" fill={tone.fill} />
      )}
    </svg>
  );
}
