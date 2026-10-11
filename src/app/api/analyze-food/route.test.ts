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

  // One adjustment at a time, so a changed or deleted rule is visible instead
  // of being absorbed by the 1.0 floor. Bases: A=95 B=80 C=60. score = total/20.
  it.each([
    ["sugar > 22.5 g costs 20", "b", { sugars_g_100g: 30 }, "3.0"], // 80-20=60
    ["sugar > 10 g costs 12", "b", { sugars_g_100g: 15 }, "3.4"], // 80-12=68
    ["sodium > 600 mg costs 18", "b", { sodium_mg_100g: 700 }, "3.1"], // 80-18=62
    ["sodium > 400 mg costs 12", "b", { sodium_mg_100g: 500 }, "3.4"], // 80-12=68
    ["saturated fat > 5 g costs 15", "a", { saturated_fat_g_100g: 8 }, "4.0"], // 95-15=80
    ["saturated fat > 2 g costs 8", "b", { saturated_fat_g_100g: 3 }, "3.6"], // 80-8=72
    ["fibre > 6 g adds 10", "c", { fibre_g_100g: 7 }, "3.5"], // 60+10=70
    ["fibre > 3 g adds 6", "c", { fibre_g_100g: 4 }, "3.3"], // 60+6=66
    ["fibre > 1.5 g adds 3", "a", { fibre_g_100g: 2 }, "4.9"], // 95+3=98
    ["protein > 10 g adds 8", "c", { protein_g_100g: 12 }, "3.4"], // 60+8=68
    ["protein > 5 g adds 4", "c", { protein_g_100g: 6 }, "3.2"], // 60+4=64
    ["protein > 2 g adds 2", "b", { protein_g_100g: 3 }, "4.1"], // 80+2=82
  ])("%s", async (_label, grade, nutritionData, expected) => {
    const { body } = await analyze({ name: "Test Food", nutriScoreGrade: grade, nutritionData });
    expect(body.health_score).toBe(expected);
  });

  it("each distinct synthetic colour costs 2", async () => {
    // B=80, one colour -> 78 -> 3.9
    const { body } = await analyze({ name: "Candy", nutriScoreGrade: "b", additiveColors: ["tartrazine"] });
    expect(body.health_score).toBe("3.9");
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
