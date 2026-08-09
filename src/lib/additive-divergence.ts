/**
 * Additive regulatory divergence — substances whose permitted status differs
 * between India and other major food-safety authorities.
 *
 * See docs/brief-regulatory-divergence.md for the full design brief.
 *
 * ── Rules for maintaining this file ──────────────────────────────────────
 *
 * 1. This states what regulators DID, with dates and instruments. It is not
 *    a safety assessment. Never add a `note` that calls a substance unsafe,
 *    toxic, or carcinogenic — that is a claim this project cannot support
 *    and does not need to make.
 * 2. Every entry needs a real, checkable `source`. An entry without one does
 *    not ship, however plausible it looks.
 * 3. Divergence runs BOTH ways. India is stricter than the US on some
 *    substances and more permissive than the EU on others, and showing only
 *    one direction would misrepresent Indian regulation — which is exactly
 *    the error this feature was created to correct.
 * 4. Regulatory status changes. Bump LAST_REVIEWED when you re-check, and
 *    surface that date in any UI so staleness is visible rather than hidden.
 */

export type Jurisdiction = "india" | "eu" | "us" | "uk" | "japan";

/** Which way the divergence runs, from an Indian user's point of view. */
export type DivergenceDirection =
  /** Permitted in India, restricted or withdrawn elsewhere. */
  | "india-permits"
  /** Restricted in India, permitted (or permitted for longer) elsewhere. */
  | "india-restricts"
  /** Permitted in both, but another authority requires a consumer warning. */
  | "labelling-differs";

export interface AdditiveEntry {
  id: string;
  /** Common name as a shopper would recognise it. */
  name: string;
  /** International Numbering System code, where one exists. */
  eNumber?: string;
  /** Ingredient-list spellings to match against, all lowercase. */
  keywords: string[];
  direction: DivergenceDirection;
  /** One neutral sentence: who did what, when. No health verdict. */
  summary: string;
  /** Per-authority status, for the reference screen. */
  status: Partial<Record<Jurisdiction, string>>;
  /** The instrument or body that decided it. */
  source: string;
}

/**
 * Last date every entry below was checked against its cited source.
 * Show this wherever the data is presented.
 */
export const LAST_REVIEWED = "2026-08-09";

/**
 * Deliberately small. Each of these was verified against the cited
 * instrument; a longer list of unverified rows would be worse than a short
 * correct one. Grow it only as entries are actually checked.
 */
export const ADDITIVE_ENTRIES: AdditiveEntry[] = [
  {
    id: "titanium-dioxide",
    name: "Titanium dioxide",
    eNumber: "E171",
    keywords: ["titanium dioxide", "e171", "ins 171"],
    direction: "india-permits",
    summary:
      "The EU withdrew authorisation for titanium dioxide as a food additive on 7 August 2022. India, the US, the UK, Canada and Australia/NZ continue to permit it.",
    status: {
      india: "Permitted (GMP level)",
      eu: "Not authorised since 7 Aug 2022",
      us: "Permitted",
      uk: "Permitted",
    },
    source:
      "Commission Regulation (EU) 2022/63, following the EFSA opinion of May 2021",
  },
  {
    id: "potassium-bromate",
    name: "Potassium bromate",
    eNumber: "E924",
    keywords: ["potassium bromate", "e924", "ins 924"],
    direction: "india-restricts",
    summary:
      "India banned potassium bromate as a food additive on 20 June 2016, after a CSE study found it in 84% of sampled breads. It is also banned in the EU, UK and Canada.",
    status: {
      india: "Banned since 20 Jun 2016",
      eu: "Not permitted",
      uk: "Not permitted",
    },
    source:
      "FSSAI notification of 20 June 2016 removing it from the permitted additives list",
  },
  {
    id: "brominated-vegetable-oil",
    name: "Brominated vegetable oil",
    keywords: ["brominated vegetable oil", "bvo"],
    direction: "india-restricts",
    summary:
      "India banned brominated vegetable oil in 1990 — the UK did so in 1970, the EU in 2008 and Japan in 2010. The US FDA only revoked its authorisation in July 2024.",
    status: {
      india: "Banned since 1990",
      uk: "Banned since 1970",
      eu: "Banned since 2008",
      japan: "Banned since 2010",
      us: "Authorisation revoked Jul 2024, effective 2 Aug 2024",
    },
    source:
      "US FDA final rule, Revocation of Authorization for Use of Brominated Vegetable Oil in Food (July 2024)",
  },

  // ── The "Southampton Six" ────────────────────────────────────────────
  // Permitted in both the EU and India, but since 2010 EU law has required
  // a consumer warning on the pack that Indian law does not. That makes it a
  // labelling divergence rather than a permitted/banned one — the shopper
  // holding an Indian pack simply isn't shown something an EU shopper is.
  ...([
    ["tartrazine", "Tartrazine", "E102", ["tartrazine", "e102", "ins 102"]],
    ["quinoline-yellow", "Quinoline Yellow", "E104", ["quinoline yellow", "e104", "ins 104"]],
    ["sunset-yellow", "Sunset Yellow FCF", "E110", ["sunset yellow", "e110", "ins 110"]],
    ["carmoisine", "Carmoisine", "E122", ["carmoisine", "azorubine", "e122", "ins 122"]],
    ["ponceau-4r", "Ponceau 4R", "E124", ["ponceau 4r", "ponceau", "e124", "ins 124"]],
    ["allura-red", "Allura Red AC", "E129", ["allura red", "e129", "ins 129"]],
  ] as const).map(([id, name, eNumber, keywords]): AdditiveEntry => ({
    id,
    name,
    eNumber,
    keywords: [...keywords],
    direction: "labelling-differs",
    summary:
      `${name} is permitted in both India and the EU, but EU law requires packs containing it to carry the statement "may have an adverse effect on activity and attention in children". India has no equivalent labelling requirement.`,
    status: {
      india: "Permitted; no warning statement required",
      eu: "Permitted; warning statement required on pack",
    },
    source:
      "Regulation (EC) No 1333/2008, Annex V, following the 2007 Southampton study",
  })),
];

/**
 * Matches the curated list against an ingredient list.
 *
 * Same mechanism and same limits as detectAllergens: plain substring
 * matching over free text. It will miss unusual spellings, so callers must
 * not present an empty result as "screened and clear" — only as "none of the
 * substances we check for were found".
 *
 * Returns [] when ingredient text exists but nothing matched, and null when
 * there is no ingredient text at all. Callers must distinguish the two: the
 * fabricated "Allergen Safe" badge this project already had to remove came
 * from collapsing exactly that difference.
 */
export const detectDivergentAdditives = (
  ingredientsText: string | null | undefined
): AdditiveEntry[] | null => {
  if (!ingredientsText || !ingredientsText.trim()) return null;

  const text = ingredientsText.toLowerCase();
  return ADDITIVE_ENTRIES.filter((entry) =>
    entry.keywords.some((keyword) => text.includes(keyword))
  );
};

export const DIRECTION_LABELS: Record<DivergenceDirection, string> = {
  "india-permits": "Permitted in India, restricted elsewhere",
  "india-restricts": "Restricted in India earlier than elsewhere",
  "labelling-differs": "Warning required elsewhere, not in India",
};
