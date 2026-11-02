/**
 * Packs the team has checked by hand, with the dates printed on them.
 *
 * A barcode names a product, not a batch: the dates below belong to one
 * physical pack. So a scan of one of these codes shows the pack's own dates,
 * and says on screen that the team entered them. It never presents them as read
 * from the barcode, and the card tells the person to check their own pack.
 *
 * Dates are written as day, month, year exactly as printed, and read as UTC
 * midnight like every other printed date in the app (see gs1PrintedDate).
 */
export interface VerifiedPack {
  barcode: string;
  /** For the team's own reference; the scan keeps showing the database's name. */
  product: string;
  madeOn: string;
  bestBefore: string;
}

export const VERIFIED_PACKS: readonly VerifiedPack[] = [
  { barcode: "8908009419101", product: "Bauli Moonfils Croissant chocolate", madeOn: "2026-09-06", bestBefore: "2027-03-05" },
  { barcode: "8901719138911", product: "Parle Multi Vita Marie", madeOn: "2026-07-21", bestBefore: "2027-01-17" },
];

export const VERIFIED_PACK_NOTE = "Date entered by our team from this demo pack. Check the date on your own pack.";

export function verifiedPackFor(barcode: string): VerifiedPack | null {
  const code = (barcode || "").trim();
  return VERIFIED_PACKS.find((p) => p.barcode === code) ?? null;
}

/** The shape the scan flow already uses for a date printed on the pack. */
export function verifiedPackDate(barcode: string): { date: Date; kind: "best_before"; note: string } | null {
  const pack = verifiedPackFor(barcode);
  if (!pack) return null;
  const [y, m, d] = pack.bestBefore.split("-").map(Number);
  return { date: new Date(Date.UTC(y, m - 1, d)), kind: "best_before", note: VERIFIED_PACK_NOTE };
}
