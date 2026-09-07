import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * The containment test.
 *
 * One defect — matching a food term by raw substring or by a word-boundary
 * regex that cannot handle a plural — has now been found and fixed in five
 * separate subsystems that each reinvented it:
 *
 *   findShelfLifeRow    "Onions" missed; later "Goat Milk" -> 365 days
 *   inferItemCategory   tier-4 fallback, same bare includes()
 *   hasWord (diet.ts)   "Prawns", "Crabs", "Sausages" passed as vegetarian
 *   isExcluded          "goat milk" matched the exclusion "oat milk"
 *   detectAllergens     "soy-free" reported AS soy
 *
 * Fixing the fifth is worth little if a sixth is written next month. This
 * test fails when a new ad-hoc matcher appears in the source, so the rule
 * "matchesTerm plus the shared exclusion list is the only way anything here
 * matches a food name" is enforced by CI rather than by memory.
 *
 * Adding an entry to ALLOWED is a deliberate act that needs a reason. If the
 * reason is "it matches food terms", it is not allowed — use matchesTerm.
 */

const SRC = join(process.cwd(), "src");

/** Every .ts/.tsx file under src/, excluding tests. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(name)) continue;
    if (/\.test\.tsx?$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

const rel = (f: string) => relative(SRC, f).split(sep).join("/");

type Allow = { file: string; match: string; reason: string };

/**
 * Known, reviewed exceptions. Each is a substring/regex use that is NOT a
 * food-term match. Anything genuinely matching a food name belongs in
 * matchesTerm and must not be added here.
 */
const ALLOWED: Allow[] = [
  // ── The shared primitive itself ──────────────────────────────────────
  { file: "lib/text-match.ts", match: "text.indexOf(term, from)", reason: "matchesTerm's own implementation — this IS the primitive" },

  // ── Free-from claims: substring is correct, the claim must win ───────
  { file: "lib/diet.ts", match: "text.includes(c)", reason: "EGG_FREE_CLAIMS — a claim like 'eggless' must match as a fragment so it beats the egg terms" },
  { file: "lib/allergens.ts", match: "text.includes(claim)", reason: "FREE_FROM_CLAIMS — same rule: a 'soy-free' claim must win over the soy terms" },

  // ── User-typed search: substring is the right UX ─────────────────────
  { file: "app/page.tsx", match: "item.name.toLowerCase().includes(searchQuery", reason: "inventory search box — typing 'mil' should match 'Milk'" },
  { file: "app/recipes/page.tsx", match: "c.name.toLowerCase().includes(search", reason: "cuisine search box — same" },
  { file: "components/scan-history-modal.tsx", match: "row.product_name.toLowerCase().includes(searchQuery", reason: "scan-history search box — same" },

  // ── Not food terms at all ────────────────────────────────────────────
  { file: "app/page.tsx", match: "cleanBase.toLowerCase().includes(cleanBrand", reason: "brand-name de-duplication in a display label, not a term match" },
  { file: "app/api/analyze-food/route.ts", match: "/\\be1\\d\\d\\b/gi", reason: "E-number colour additives are a regulatory code, not a food name — no term list exists to match against; boundaries added" },
  { file: "app/api/extract/route.ts", match: '["high", "critical", "urgent"].includes(value)', reason: "enum membership on a risk level" },
  { file: "app/api/extract/route.ts", match: '["medium", "med", "soon"].includes(value)', reason: "enum membership on a risk level" },
  { file: "lib/upload-validation.ts", match: "[0x68, 0x6d].includes(b[8])", reason: "magic-byte check on a file header" },
  { file: "lib/colour-semantics.ts", match: "className.includes(token)", reason: "CSS class-name token check" },
  { file: "lib/shelf-life-data.ts", match: "all.indexOf(id) !== i", reason: "duplicate-id detection over row ids" },
  { file: "components/shopping-list-modal.tsx", match: 'name.indexOf(" — ")', reason: "splits a display label into name and quantity" },
  { file: "lib/api-auth.ts", match: 'header.toLowerCase().startsWith("bearer ")', reason: "HTTP Authorization scheme" },
  { file: "app/page.tsx", match: 'id.startsWith("seed-")', reason: "identifier prefix on a demo row id" },
  { file: "app/page.tsx", match: '!decodedText.startsWith("0")', reason: "barcode digit normalisation" },
  { file: "app/login/page.tsx", match: 'result.error.toLowerCase().includes("email not confirmed")', reason: "Supabase auth error string" },
  { file: "app/page.tsx", match: 'error.message?.includes("does not exist")', reason: "PostgREST missing-relation error string" },
  { file: "components/household-modal.tsx", match: 'createError.message?.includes("does not exist")', reason: "PostgREST missing-relation error string" },
  { file: "components/household-modal.tsx", match: 'rpcError.message?.includes("does not exist")', reason: "PostgREST missing-relation error string" },
  { file: "components/impact-dashboard-modal.tsx", match: 'fetchError.message?.includes("does not exist")', reason: "PostgREST missing-relation error string" },
  { file: "components/shopping-list-modal.tsx", match: 'fetchError.message?.includes("does not exist")', reason: "PostgREST missing-relation error string" },
  { file: "components/scan-history-modal.tsx", match: 'fetchError.message?.includes("does not exist")', reason: "PostgREST missing-relation error string" },
  { file: "lib/allergens.ts", match: "phrase.includes(term)", reason: "compares two entries of our own lists — does an exclusion phrase contain this allergen term — never touches user text" },
  { file: "app/page.tsx", match: 'data_accuracy_warning?.includes("⚠️")', reason: "checks for a marker glyph in a warning string" },
  { file: "app/api/contribute-product/route.ts", match: 'OFF_WRITE_BASE_URL.includes(".net")', reason: "detects the staging host in a URL" },
  { file: "lib/shelf-life.ts", match: 'entry.key.includes(" ")', reason: "REMOVED — kept here only so a reintroduction is loud" },
];

// A line is suspicious if it uses one of these mechanisms.
const PATTERNS: { name: string; re: RegExp }[] = [
  { name: ".includes(", re: /\.includes\(/ },
  { name: ".indexOf(", re: /\.indexOf\(/ },
  { name: ".startsWith(", re: /\.startsWith\(/ },
  { name: ".endsWith(", re: /\.endsWith\(/ },
  { name: "\\b regex", re: /new RegExp\(|\/\\\\b/ },
];

type Finding = { file: string; line: number; text: string; via: string };

function scan(): Finding[] {
  const findings: Finding[] = [];
  for (const file of sourceFiles(SRC)) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((raw, i) => {
      const line = raw.trim();
      // Comments and doc blocks describe the defect constantly; skip them.
      if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) return;
      for (const p of PATTERNS) {
        if (!p.re.test(line)) continue;
        const f = rel(file);
        const allowed = ALLOWED.some((a) => a.file === f && line.includes(a.match));
        if (!allowed) findings.push({ file: f, line: i + 1, text: line, via: p.name });
      }
    });
  }
  return findings;
}

describe("matcher containment", () => {
  it("no ad-hoc term matching outside matchesTerm and the reviewed allow-list", () => {
    const findings = scan();
    const report = findings
      .map((f) => `\n  ${f.file}:${f.line}  [${f.via}]\n    ${f.text}`)
      .join("");
    expect(
      findings,
      findings.length === 0
        ? ""
        : `Found ${findings.length} un-allowed substring/regex match(es).\n` +
          `If any of these match a FOOD NAME, ingredient or product string, use ` +
          `matchesTerm from lib/text-match.ts and the shared exclusion list — do not ` +
          `add it to ALLOWED. If it is genuinely not a food-term match, add it to ` +
          `ALLOWED in this file with a reason.${report}\n`
    ).toEqual([]);
  });

  it("every allow-list entry carries a reason and none of them claims to match food terms", () => {
    for (const a of ALLOWED) {
      expect(a.reason.length, `${a.file} needs a reason`).toBeGreaterThan(10);
      // The allow-list is not an escape hatch for the thing it exists to stop.
      expect(
        /matches? (a )?(food|ingredient|product) (name|term)/i.test(a.reason) &&
          !/not a food|NOT a food|no term list/i.test(a.reason),
        `${a.file}: "${a.reason}" — food-term matching belongs in matchesTerm`
      ).toBe(false);
    }
  });

  it("the shared matcher is actually used by every food matcher", () => {
    const mustImport = [
      "lib/shelf-life.ts",
      "lib/item-category.ts",
      "lib/diet.ts",
      "lib/allergens.ts",
      "app/api/analyze-food/route.ts",
      "app/api/find-recipe/route.ts",
      "components/restock-suggestions.tsx",
    ];
    for (const f of mustImport) {
      const src = readFileSync(join(SRC, f), "utf8");
      expect(src, `${f} must match food terms through matchesTerm`).toMatch(/matchesTerm/);
    }
  });
});
