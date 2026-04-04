import { NextResponse } from "next/server";
import { createRequestContext } from "@/lib/server-logger";

type NutriScoreGrade = "a" | "b" | "c" | "d" | "e";

type NutritionPayload = {
  sugars_g_100g?: number;
  sodium_mg_100g?: number;
  saturated_fat_g_100g?: number;
  fibre_g_100g?: number;
  protein_g_100g?: number;
};

const NON_FOOD_KEYWORDS = [
  "soap", "detergent", "shampoo", "conditioner", "toothpaste", "cream", "lotion", "cotton bud", "cotton buds", "sanitizer", "disinfectant", "bleach", "cleaner", "battery", "candle",
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const toNum = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const extractAdditiveColorMatches = (ingredientsRaw: string): string[] => {
  const ingredients = ingredientsRaw.toLowerCase();
  const regex = /(tartrazine|sunset yellow|allura red|brilliant blue|erythrosine|carmoisine|ponceau|yellow\s*5|red\s*40|blue\s*1|e1\d\d)/gi;
  return Array.from(new Set(ingredients.match(regex) || []));
};

const detectIsFood = (name: string, categories: string): boolean => {
  const text = `${name} ${categories}`.toLowerCase();
  return !NON_FOOD_KEYWORDS.some((kw) => text.includes(kw));
};

const nutriScoreBase = (grade?: string): number => {
  const g = (grade || "").toLowerCase() as NutriScoreGrade;
  if (g === "a") return 95;
  if (g === "b") return 80;
  if (g === "c") return 60;
  if (g === "d") return 40;
  if (g === "e") return 20;
  return 55;
};

export async function POST(req: Request) {
  const log = createRequestContext("api/analyze-food");
  log.info("Request received");

  try {
    const {
      name,
      ingredients,
      categories,
      nutritionData,
      nutriScoreGrade,
      additivesCount,
      additiveColors,
    } = (await req.json()) as {
      name?: string;
      ingredients?: string;
      categories?: string;
      nutritionData?: NutritionPayload;
      nutriScoreGrade?: string;
      additivesCount?: number;
      additiveColors?: string[];
    };

    const productName = String(name || "").trim();
    const productIngredients = String(ingredients || "").trim();
    const productCategories = String(categories || "").trim();

    log.info("Payload parsed", {
      hasName: Boolean(productName),
      hasIngredients: Boolean(productIngredients),
      hasCategories: Boolean(productCategories),
      productName: productName.slice(0, 80),
    });

    const isFood = detectIsFood(productName, productCategories);
    if (!isFood) {
      return NextResponse.json({
        is_food: false,
        health_score: "1.0",
        health_grade_text: "Not Food",
        processing_level: "Unknown",
        data_accuracy_warning: "Detected as non-food item from product metadata.",
        macronutrients: {},
        concerns: [],
        positives: [],
        alternatives: [],
      });
    }

    const n = nutritionData || {};
    const sugars = toNum(n.sugars_g_100g);
    const sodium = toNum(n.sodium_mg_100g);
    const satFat = toNum(n.saturated_fat_g_100g);
    const fibre = toNum(n.fibre_g_100g);
    const protein = toNum(n.protein_g_100g);

    const knownAdditivesCount = clamp(Math.round(toNum(additivesCount) || 0), 0, 30);
    const colorMatches = Array.isArray(additiveColors) && additiveColors.length > 0
      ? additiveColors
      : extractAdditiveColorMatches(productIngredients);

    let score100 = nutriScoreBase(nutriScoreGrade);
    const concerns: Array<{ title: string; level: string; details: string }> = [];
    const positives: Array<{ title: string; level: string; details: string }> = [];

    score100 -= Math.min(20, knownAdditivesCount * 2);
    if (knownAdditivesCount >= 4) {
      concerns.push({
        title: "Multiple additives",
        level: "Medium Risk",
        details: `${knownAdditivesCount} additives/preservatives detected in product metadata.`,
      });
    } else if (knownAdditivesCount <= 1) {
      positives.push({
        title: "Low additive load",
        level: "Positive",
        details: "Minimal additives detected.",
      });
    }

    if (typeof sugars === "number") {
      if (sugars > 22.5) {
        score100 -= 20;
        concerns.push({ title: "High sugar", level: "High Risk", details: `${sugars.toFixed(1)} g sugar per 100g.` });
      } else if (sugars > 10) {
        score100 -= 12;
        concerns.push({ title: "Moderate-high sugar", level: "Medium Risk", details: `${sugars.toFixed(1)} g sugar per 100g.` });
      } else if (sugars <= 5) {
        positives.push({ title: "Lower sugar", level: "Positive", details: `${sugars.toFixed(1)} g sugar per 100g.` });
      }
    }

    if (typeof sodium === "number") {
      if (sodium > 600) {
        score100 -= 18;
        concerns.push({ title: "Very high sodium", level: "High Risk", details: `${Math.round(sodium)} mg sodium per 100g.` });
      } else if (sodium > 400) {
        score100 -= 12;
        concerns.push({ title: "High sodium", level: "Medium Risk", details: `${Math.round(sodium)} mg sodium per 100g.` });
      } else if (sodium <= 120) {
        positives.push({ title: "Low sodium", level: "Positive", details: `${Math.round(sodium)} mg sodium per 100g.` });
      }
    }

    if (typeof satFat === "number") {
      if (satFat > 5) {
        score100 -= 15;
        concerns.push({ title: "High saturated fat", level: "High Risk", details: `${satFat.toFixed(1)} g saturated fat per 100g.` });
      } else if (satFat > 2) {
        score100 -= 8;
      } else if (satFat <= 1) {
        positives.push({ title: "Lower saturated fat", level: "Positive", details: `${satFat.toFixed(1)} g saturated fat per 100g.` });
      }
    }

    if (typeof fibre === "number") {
      if (fibre > 6) score100 += 10;
      else if (fibre > 3) score100 += 6;
      else if (fibre > 1.5) score100 += 3;

      if (fibre > 3) {
        positives.push({ title: "Good fibre", level: "Positive", details: `${fibre.toFixed(1)} g fibre per 100g.` });
      }
    }

    if (typeof protein === "number") {
      if (protein > 10) score100 += 8;
      else if (protein > 5) score100 += 4;
      else if (protein > 2) score100 += 2;

      if (protein > 5) {
        positives.push({ title: "Good protein", level: "Positive", details: `${protein.toFixed(1)} g protein per 100g.` });
      }
    }

    if (colorMatches.length > 0) {
      score100 -= Math.min(8, colorMatches.length * 2);
      concerns.push({
        title: "Artificial colors detected",
        level: "Medium Risk",
        details: `Detected: ${colorMatches.join(", ")}`,
      });
    }

    score100 = clamp(score100, 20, 100);
    const healthScore = (score100 / 20).toFixed(1);

    let gradeText = "Fair";
    if (score100 >= 85) gradeText = "Excellent";
    else if (score100 >= 70) gradeText = "Good";
    else if (score100 >= 55) gradeText = "Fair";
    else if (score100 >= 40) gradeText = "Poor";
    else gradeText = "Very Poor";

    const processingLevel =
      knownAdditivesCount >= 8 ? "Ultra-Processed" :
      knownAdditivesCount >= 3 ? "Processed" :
      "Minimally Processed";

    const hasReliableNutrition = [sugars, sodium, satFat, fibre, protein].some((v) => typeof v === "number");

    const response = {
      is_food: true,
      health_score: healthScore,
      health_grade_text: gradeText,
      processing_level: processingLevel,
      data_accuracy_warning: hasReliableNutrition
  ? "Score computed from verified nutrition label data."
  : "⚠️ This product's nutrition data isn't in our database yet. Score is estimated from ingredients only — check the physical label for accurate values.",
      macronutrients: {
        total_sugars_g: typeof sugars === "number" ? `${sugars.toFixed(1)} g` : "N/A",
        sodium_mg: typeof sodium === "number" ? `${Math.round(sodium)} mg` : "N/A",
        saturated_fat_g: typeof satFat === "number" ? `${satFat.toFixed(1)} g` : "N/A",
        fibre_g: typeof fibre === "number" ? `${fibre.toFixed(1)} g` : "N/A",
        protein_g: typeof protein === "number" ? `${protein.toFixed(1)} g` : "N/A",
      },
      concerns,
      positives,
      alternatives:
        score100 < 55
          ? [
              { name: "Lower-sugar alternative", score: "4.2" },
              { name: "Lower-sodium variant", score: "4.0" },
              { name: "Less-processed option", score: "4.5" },
            ]
          : [
              { name: "Keep this as occasional choice", score: "4.0" },
              { name: "Pair with fresh produce", score: "4.3" },
            ],
    };

    log.info("Deterministic analysis computed", {
      isFood: true,
      score100,
      concernsCount: concerns.length,
      positivesCount: positives.length,
    });

    return NextResponse.json(response);
  } catch (error: unknown) {
    log.error("Unhandled analysis error", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : null,
    });
    return NextResponse.json({ error: "Failed to analyze food" }, { status: 500 });
  }
}
