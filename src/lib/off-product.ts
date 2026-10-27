/**
 * Getting a usable name out of an Open Food Facts product.
 *
 * Many Indian products in Open Food Facts have their ingredients and
 * nutrition filled in but no `product_name`: the name was entered only in the
 * product's own language (`product_name_hi`, `product_name_mr`, …), only as
 * an abbreviation, or not at all. The scanner used to read four fields and,
 * finding none, labelled the item "Unknown Product" — while showing its real
 * ingredients underneath. The add-product form, reading only `product_name`,
 * said the barcode was not in the database at all.
 */

/** Name fields worth asking for on every lookup, in the order they are tried. */
export const OFF_NAME_FIELDS = [
  "product_name",
  "product_name_en",
  "product_name_in",
  "product_name_hi",
  "abbreviated_product_name",
  "generic_name",
  "generic_name_en",
  "lc",
] as const;

type OffNameSource = Partial<Record<string, unknown>>;

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/**
 * The product's own-language name fields, for a second lookup when the first
 * found nothing in English. `lc` is OFF's language code ("hi", "mr", "fr").
 */
export function ownLanguageNameFields(lc: unknown): string[] {
  const code = clean(lc).toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return [];
  return [`product_name_${code}`, `generic_name_${code}`];
}

/** The best name OFF has for this product, or "" when it has none. */
export function offProductName(product: OffNameSource | null | undefined): string {
  if (!product) return "";
  const lcFields = ownLanguageNameFields(product.lc);
  for (const field of [...OFF_NAME_FIELDS.filter((f) => f !== "lc"), ...lcFields]) {
    const name = clean(product[field]);
    if (name) return name;
  }
  return "";
}

/**
 * A name to suggest from the product's categories, for the person to confirm
 * or correct: the most specific (last) English category, "Instant noodles"
 * from "Foods, Pastas, Noodles, Instant noodles". Never used without asking.
 */
export function suggestNameFromCategories(categories: unknown): string {
  const parts = clean(categories)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    // OFF writes untranslated categories as "hi:…" or "fr:…"; "en:…" is fine.
    .filter((c) => !/^[a-z]{2}:/.test(c) || c.startsWith("en:"))
    .map((c) => c.replace(/^en:/, "").replace(/-/g, " ").trim());
  const last = parts[parts.length - 1];
  if (!last || last.length > 60) return "";
  return last.charAt(0).toUpperCase() + last.slice(1);
}
