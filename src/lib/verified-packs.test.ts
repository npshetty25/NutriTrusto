import { describe, expect, it } from "vitest";
import { VERIFIED_PACKS, VERIFIED_PACK_NOTE, verifiedPackDate, verifiedPackFor } from "@/lib/verified-packs";

const isValidEan13 = (code: string) => {
  if (!/^\d{13}$/.test(code)) return false;
  const sum = [...code.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
};

describe("verified packs", () => {
  it("lists only real, valid barcodes, once each", () => {
    expect(VERIFIED_PACKS.every((p) => isValidEan13(p.barcode))).toBe(true);
    expect(new Set(VERIFIED_PACKS.map((p) => p.barcode)).size).toBe(VERIFIED_PACKS.length);
  });

  it("has a best-before six months after the made-on date, as printed", () => {
    for (const p of VERIFIED_PACKS) {
      const days = (Date.parse(p.bestBefore) - Date.parse(p.madeOn)) / 86_400_000;
      expect(days).toBeGreaterThan(170);
      expect(days).toBeLessThan(190);
    }
  });

  it("gives the Moonfils pack its printed best-before at UTC midnight, with the disclosure", () => {
    const found = verifiedPackDate("8908009419101");
    expect(found?.kind).toBe("best_before");
    expect(found?.date.toISOString()).toBe("2027-03-05T00:00:00.000Z");
    expect(found?.note).toBe(VERIFIED_PACK_NOTE);
    expect(VERIFIED_PACK_NOTE).toMatch(/our team/i);
    expect(VERIFIED_PACK_NOTE).toMatch(/your own pack/i);
  });

  it("knows nothing about any other barcode, or an empty one", () => {
    expect(verifiedPackFor("8901262010023")).toBeNull();
    expect(verifiedPackDate("")).toBeNull();
  });
});
