import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { DISH_CATALOG } from "@/lib/dish-catalog";
import { findDietViolations, normalizeDiet } from "@/lib/diet-check";

/**
 * Recipe evaluation against the real model.
 *
 * Twelve fixed pantries across the three diets. For each, the recipe route
 * runs exactly as in production, and the result is scored on what matters:
 *
 *   - diet: zero violations, always (a hard failure)
 *   - real dish: the title is on the known-dish list (a hard failure)
 *   - honest pantry: every "from your pantry" item is really in the pantry
 *   - urgency: whether an item due within 2 days was used, when one was there
 *
 * Only sign-in is stubbed. Run with `npm run eval:recipes`.
 */

// Load GEMINI_API_KEY from .env.local, as `next dev` would.
if (!process.env.GEMINI_API_KEY && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*GEMINI_API_KEY\s*=\s*(.*)\s*$/.exec(line);
    if (m) process.env.GEMINI_API_KEY = m[1].replace(/^["']|["']$/g, "");
  }
}

let userSeq = 0;
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  getRequestUser: async () => ({ id: `eval-user-${++userSeq}` }),
}));

type Item = { name: string; daysLeft: number; daysPastEstimate?: number };
type Scenario = { label: string; diet: string; items: Item[] };

const SCENARIOS: Scenario[] = [
  { label: "veg: palak, paneer, rice", diet: "Veg", items: [{ name: "Palak", daysLeft: 1 }, { name: "Paneer", daysLeft: 2 }, { name: "Basmati Rice", daysLeft: 200 }] },
  { label: "veg: potato, cauliflower, peas", diet: "Veg", items: [{ name: "Cauliflower", daysLeft: 1 }, { name: "Potatoes", daysLeft: 15 }, { name: "Green Peas", daysLeft: 3 }] },
  { label: "veg: bhindi, tomato", diet: "Veg", items: [{ name: "Bhindi", daysLeft: 1 }, { name: "Tomatoes", daysLeft: 4 }] },
  { label: "egg: eggs, onion, tomato", diet: "Eggtarian", items: [{ name: "Eggs", daysLeft: 2 }, { name: "Onions", daysLeft: 20 }, { name: "Tomatoes", daysLeft: 3 }] },
  { label: "egg: eggs, spinach, paneer", diet: "Eggtarian", items: [{ name: "Spinach", daysLeft: 1 }, { name: "Eggs", daysLeft: 5 }, { name: "Paneer", daysLeft: 3 }] },
  { label: "non-veg: chicken, curd, potato", diet: "Non-Veg", items: [{ name: "Chicken Breast", daysLeft: 1 }, { name: "Curd", daysLeft: 3 }, { name: "Potatoes", daysLeft: 20 }] },
  { label: "non-veg: fish, tomato", diet: "Non-Veg", items: [{ name: "Fish", daysLeft: 1 }, { name: "Tomatoes", daysLeft: 4 }] },
  { label: "veg: curd, besan, cucumber", diet: "Veg", items: [{ name: "Curd", daysLeft: 1 }, { name: "Besan", daysLeft: 120 }, { name: "Cucumber", daysLeft: 3 }] },
  { label: "veg: carrots, milk", diet: "Veg", items: [{ name: "Carrots", daysLeft: 2 }, { name: "Full Cream Milk", daysLeft: 1 }] },
  { label: "veg user, chicken in the pantry", diet: "Veg", items: [{ name: "Chicken Breast", daysLeft: 1 }, { name: "Spinach", daysLeft: 2 }, { name: "Paneer", daysLeft: 3 }] },
  { label: "veg: mushroom, peas, capsicum", diet: "Veg", items: [{ name: "Mushrooms", daysLeft: 1 }, { name: "Green Peas", daysLeft: 4 }, { name: "Capsicum", daysLeft: 5 }] },
  { label: "no preference: bread, capsicum", diet: "none", items: [{ name: "Bread", daysLeft: 1 }, { name: "Capsicum", daysLeft: 4 }, { name: "Onions", daysLeft: 20 }] },
];

const KNOWN = new Set(DISH_CATALOG.map((d) => d.name.toLowerCase()));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!process.env.GEMINI_API_KEY)("recipe evaluation (real model)", () => {
  it("scores twelve pantries", async () => {
    const { POST } = await import("@/app/api/find-recipe/route");
    const rows: Record<string, string | number | boolean>[] = [];

    for (const s of SCENARIOS) {
      const res = await POST(new Request("http://localhost/api/find-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: s.items, dietaryPreference: s.diet }),
      }));
      const body = await res.json();
      const recipe = body.recipe as { title?: string; usesItems?: string[] } | undefined;
      const pantryNames = new Set(s.items.map((i) => i.name.toLowerCase()));
      const urgent = s.items.filter((i) => i.daysLeft <= 2).map((i) => i.name.toLowerCase());
      const used = (recipe?.usesItems ?? []).map((n) => n.toLowerCase());

      rows.push({
        scenario: s.label,
        status: res.status,
        dish: recipe?.title ?? `(${body.error ?? "no recipe"})`,
        realDish: recipe ? KNOWN.has(String(recipe.title).toLowerCase()) : false,
        dietViolations: recipe ? findDietViolations(JSON.stringify(recipe), normalizeDiet(s.diet)).length : 0,
        pantryHonest: used.every((n) => pantryNames.has(n)),
        usedUrgent: urgent.length === 0 || used.some((n) => urgent.includes(n)),
      });
      // Free-tier Gemini allows only a few requests a minute.
      await pause(8_000);
    }

    console.table(rows);
    const served = rows.filter((r) => r.status === 200);
    console.log(
      `served ${served.length}/${rows.length}; real dish ${served.filter((r) => r.realDish).length}/${served.length}; ` +
      `used an urgent item ${served.filter((r) => r.usedUrgent).length}/${served.length}`
    );

    // Hard requirements: never a diet violation, never an invented dish,
    // never credit an item that is not in the pantry.
    for (const r of served) {
      expect(r.dietViolations, String(r.scenario)).toBe(0);
      expect(r.realDish, String(r.scenario)).toBe(true);
      expect(r.pantryHonest, String(r.scenario)).toBe(true);
    }
    expect(served.length).toBeGreaterThanOrEqual(10);
  });
});
