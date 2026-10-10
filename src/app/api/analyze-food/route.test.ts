import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { silenceLogs, TEST_USER } from "@/test/route-helpers";
import type { FoodAnalysis } from "@/lib/food-analysis";

const getRequestUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  getRequestUser,
}));

import { POST } from "./route";

let userSeq = 0;

beforeEach(() => {
  silenceLogs();
  getRequestUser.mockReset();
  getRequestUser.mockResolvedValue(TEST_USER(`analyze-user-${++userSeq}`));
});
afterEach(() => vi.restoreAllMocks());

const analyze = async (payload: Record<string, unknown>) => {
  const res = await POST(
    new Request("http://localhost/api/analyze-food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
  return { res, body: (await res.json()) as FoodAnalysis };
};
const titles = (list: Array<{ title: string }>) => list.map((x) => x.title);

// The score is a deterministic sum of adjustments to a Nutri-Score base, then
// /20 to a 1.0-5.0 figure. Each expectation below is worked out by hand from
// the thresholds in the route, not copied from its output.
describe("POST /api/analyze-food — scoring", () => {
  it("an A grade with no extra data scores 95/100 = 4.8 and says the data is estimated", async () => {
    const { body } = await analyze({ name: "Plain Oats", nutriScoreGrade: "a" });
    expect(body.health_score).toBe("4.8");
    expect(body.health_grade_text).toBe("Excellent");
    expect(body.data_accuracy_warning).toMatch(/estimated from ingredients only/);
    expect(titles(body.positives)).toContain("Low additive load");
  });

  it("stacks penalties but never goes below 1.0", async () => {
    // E=20, sugar>22.5 (-20), sodium>600 (-18), sat fat>5 (-15) => -33 -> clamped to 20 => 1.0
    const { body } = await analyze({
      name: "Sugary Salty Chips",
      nutriScoreGrade: "e",
      nutritionData: { sugars_g_100g: 30, sodium_mg_100g: 700, saturated_fat_g_100g: 8 },
    });
    expect(body.health_score).toBe("1.0");
    expect(body.health_grade_text).toBe("Very Poor");
    expect(titles(body.concerns)).toEqual(["High sugar", "Very high sodium", "High saturated fat"]);
  });

  it("combines additives, penalties and bonuses: C(60) -4 +10 +8 = 74 => 3.7 Good", async () => {
    const { body } = await analyze({
      name: "Multigrain Cereal",
      nutriScoreGrade: "c",
      additivesCount: 2,
      nutritionData: { sugars_g_100g: 4, sodium_mg_100g: 100, saturated_fat_g_100g: 0.5, fibre_g_100g: 7, protein_g_100g: 12 },
    });
    expect(body.health_score).toBe("3.7");
    expect(body.health_grade_text).toBe("Good");
    expect(titles(body.positives)).toEqual(
      expect.arrayContaining(["Lower sugar", "Low sodium", "Lower saturated fat", "Good fibre", "Good protein"])
    );
    expect(body.data_accuracy_warning).toMatch(/verified nutrition label data/);
  });

  it("an unknown grade starts from 55", async () => {
    const { body } = await analyze({ name: "Mystery Snack" });
    expect(body.health_score).toBe("2.8"); // 55/20 = 2.75 -> 2.8
    expect(body.health_grade_text).toBe("Fair");
  });

  it("caps the additive penalty at 20 and labels 8+ additives ultra-processed", async () => {
    // 55 - min(20, 30*2) = 35 -> 1.75 -> "1.8"
    const { body } = await analyze({ name: "Instant Noodles", additivesCount: 50 });
    expect(body.health_score).toBe("1.8");
    expect(body.processing_level).toBe("Ultra-Processed");
    expect(titles(body.concerns)).toContain("Multiple additives");
  });

  it("finds named synthetic colours and E-numbers in the ingredient text", async () => {
    // 55 - min(8, 3*2) = 49 -> 2.45 -> "2.5"; low additive load adds a positive only
    const { body } = await analyze({
      name: "Orange Candy",
      ingredients: "Sugar, glucose syrup, Tartrazine, Sunset Yellow, colour (E102)",
    });
    const colour = body.concerns.find((c) => c.title === "Artificial colors detected");
    expect(colour?.details).toMatch(/tartrazine/);
    expect(colour?.details).toMatch(/sunset yellow/);
    expect(colour?.details).toMatch(/e102/);
    expect(body.health_score).toBe("2.5");
  });

  it("does not mistake a longer alphanumeric token for an E-number", async () => {
    const { body } = await analyze({ name: "Biscuit", ingredients: "wheat flour, code xe1023y" });
    expect(titles(body.concerns)).not.toContain("Artificial colors detected");
  });

  it("trusts colours the client already extracted", async () => {
    const { body } = await analyze({ name: "Candy", additiveColors: ["allura red"] });
    expect(titles(body.concerns)).toContain("Artificial colors detected");
  });
});

describe("POST /api/analyze-food — what counts as food", () => {
  it.each(["Dove Soap Bar", "Colgate Toothpaste", "Face Cream", "AA Batteries"])("%s is not food and gets no invented score", async (name) => {
    const { body } = await analyze({ name });
    expect(body.is_food).toBe(false);
    expect(body.health_grade_text).toBe("Not Food");
    expect(body.concerns).toEqual([]);
  });

  it.each(["Ice Cream", "Amul Fresh Cream", "Cream Biscuit", "Coffee Creamer"])(
    "%s is still food (regression: 'cream' alone used to mark these non-food)",
    async (name) => {
      const { body } = await analyze({ name });
      expect(body.is_food).toBe(true);
    }
  );

  it("considers the categories field as well as the name", async () => {
    const { body } = await analyze({ name: "Mild Lather", categories: "Personal care, Shampoo" });
    expect(body.is_food).toBe(false);
  });
});

describe("POST /api/analyze-food — gatekeeping", () => {
  it("401 without a signed-in user", async () => {
    getRequestUser.mockResolvedValue(null);
    const { res } = await analyze({ name: "Anything" });
    expect(res.status).toBe(401);
  });

  it("429 once one account exceeds 20 analyses a minute", async () => {
    getRequestUser.mockResolvedValue(TEST_USER("analyze-burst"));
    for (let i = 0; i < 20; i++) expect((await analyze({ name: "Oats" })).res.status).toBe(200);
    const { res } = await analyze({ name: "Oats" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("500 with a generic body when the request is not JSON", async () => {
    const res = await POST(new Request("http://localhost/api/analyze-food", { method: "POST", body: "not json" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to analyze food" });
  });
});
