/**
 * Reads the product code and printed dates out of a GS1 barcode.
 *
 * The ordinary barcode on a pack (EAN-13 / UPC) identifies the PRODUCT, not
 * the pack in your hand, so it carries no date at all — every jar of the same
 * jam shares one EAN. The newer GS1 DataMatrix and GS1-128 codes, increasingly
 * printed on Indian dairy, medicine and packaged food, carry the batch data
 * too, as "Application Identifiers":
 *
 *   (01) GTIN — the product code, the same number an EAN-13 would hold
 *   (17) expiry date             YYMMDD
 *   (15) best before date        YYMMDD
 *   (11) production / mfg date   YYMMDD
 *
 * Scanners hand these over in one of two shapes: human-readable with
 * brackets, "(01)08901234567890(17)270131(10)AB12", or raw, where
 * variable-length fields end in an ASCII group separator (0x1D) and the
 * string may start with a symbology prefix such as "]d2" or "]C1".
 *
 * Returns null for anything that is not a GS1 string, including a plain
 * EAN-13 — that is the common case and the caller looks it up as before.
 */

export interface Gs1Data {
  /** 14-digit GTIN. */
  gtin: string | null;
  /** The code Open Food Facts indexes: GTIN-14 with its leading zero padding removed. */
  lookupCode: string | null;
  expiry: Date | null;
  bestBefore: Date | null;
  production: Date | null;
}

const GS = "\u001d";

/** Fixed-length AIs we may meet before the ones we want; value lengths. */
const FIXED: Record<string, number> = {
  "00": 18, "01": 14, "02": 14,
  "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6,
  "20": 2,
};

/** Variable-length AIs (terminated by GS or end of string). */
const VARIABLE = new Set(["10", "21", "22", "30", "37", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99"]);

/**
 * GS1 dates are YYMMDD. A DD of "00" means "end of that month" — the usual
 * way a month-only best-before is encoded. Two-digit years are read as 20YY,
 * which is right for every date a pack in a kitchen today can carry.
 */
export function parseGs1Date(yymmdd: string): Date | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const year = 2000 + Number(yymmdd.slice(0, 2));
  const month = Number(yymmdd.slice(2, 4));
  const day = Number(yymmdd.slice(4, 6));
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const d = day === 0 ? lastDay : day;
  if (d > lastDay) return null;
  return new Date(Date.UTC(year, month - 1, d));
}

function fromFields(fields: Record<string, string>): Gs1Data | null {
  if (!fields["01"] && !fields["17"] && !fields["15"]) return null;
  const gtin = fields["01"] && /^\d{14}$/.test(fields["01"]) ? fields["01"] : null;
  return {
    gtin,
    // OFF stores EAN-13s; a GTIN-14 for a retail unit is that EAN-13 with a
    // leading 0. Strip exactly the padding, never a meaningful digit.
    lookupCode: gtin ? gtin.replace(/^0+(?=\d{8,13}$)/, "") : null,
    expiry: fields["17"] ? parseGs1Date(fields["17"]) : null,
    bestBefore: fields["15"] ? parseGs1Date(fields["15"]) : null,
    production: fields["11"] ? parseGs1Date(fields["11"]) : null,
  };
}

export function parseGs1(raw: string): Gs1Data | null {
  const text = (raw || "").trim();
  if (!text) return null;

  // Human-readable form: (AI)value(AI)value…
  if (/^\(\d{2,4}\)/.test(text)) {
    const fields: Record<string, string> = {};
    for (const m of text.matchAll(/\((\d{2,4})\)([^(]*)/g)) fields[m[1]] = m[2].trim();
    return fromFields(fields);
  }

  // Raw form. A plain 8–13 digit EAN/UPC is never GS1 element data.
  let body = text.replace(/^\][A-Za-z]\d/, "");
  if (/^\d{8,13}$/.test(body)) return null;
  if (body.slice(0, 1) === GS) body = body.slice(1);
  // Must open with a known AI to be worth parsing at all.
  if (!(body.slice(0, 2) in FIXED) && !VARIABLE.has(body.slice(0, 2))) return null;

  const fields: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    if (body[i] === GS) { i++; continue; }
    const ai = body.slice(i, i + 2);
    if (ai in FIXED) {
      const len = FIXED[ai];
      const value = body.slice(i + 2, i + 2 + len);
      if (value.length !== len) break;
      fields[ai] = value;
      i += 2 + len;
    } else if (VARIABLE.has(ai)) {
      let end = i + 2;
      while (end < body.length && body[end] !== GS) end++;
      fields[ai] = body.slice(i + 2, end);
      i = end + 1;
    } else {
      // An AI we do not model — stop rather than mis-read the rest.
      break;
    }
  }
  return fromFields(fields);
}

/** The printed date that limits how long the pack keeps: expiry, else best-before. */
export function gs1UseByDate(data: Gs1Data | null): Date | null {
  return data?.expiry ?? data?.bestBefore ?? null;
}

/**
 * The printed date and which kind it is. GS1 AI 17 is the expiration date
 * (a use-by), AI 15 is best-before — the barcode says which, so no guessing.
 */
export function gs1PrintedDate(data: Gs1Data | null): { date: Date; kind: "use_by" | "best_before" } | null {
  if (data?.expiry) return { date: data.expiry, kind: "use_by" };
  if (data?.bestBefore) return { date: data.bestBefore, kind: "best_before" };
  return null;
}
