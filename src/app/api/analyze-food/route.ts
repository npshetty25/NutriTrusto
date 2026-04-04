import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: Request) {
  const log = createRequestContext("api/analyze-food");
  log.info("Request received");

  try {
    const { name, ingredients, categories } = await req.json();
    log.info("Payload parsed", {
      hasName: Boolean(name),
      hasIngredients: Boolean(ingredients),
      hasCategories: Boolean(categories),
      productName: String(name || "").slice(0, 80),
    });

    if (!genAI) {
      // Fallback if API key is not present
      log.warn("GEMINI_API_KEY missing, returning fallback analysis");
      return NextResponse.json({
        is_food: true,
        health_rating: "Requires API Key",
        coloring_agents: [],
        banned_ingredients: [],
        alternatives: []
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    log.info("Calling Gemini model", { model: "gemini-2.5-flash" });

    const prompt = `You are a strict, legally-compliant food safety analyst and nutritionist. 
We have a product named: "${name}"
Categorized as: "${categories || 'Unknown'}"
Ingredients provided on label: "${ingredients || 'Not specified'}"

CRITICAL ANTI-HALLUCINATION PROTOCOL:
If the ingredients list says "None provided", "Not specified", or relies purely on general knowledge:
- You MUST NOT guess, extrapolate, or hallucinate specific chemical additives, artificial colors, or banned preservatives (such as Tartrazine, Titanium Dioxide, E171, Yellow 5, etc.) unless you have absolute, 100% verified ground-truth knowledge that this specific brand and exact product variant contains them.
- Legal liability is severely at stake. Falsely claiming a product contains a banned chemical when it does not is defamation.
- It is MANDATORY to return completely empty arrays for "coloring_agents" and "banned_ingredients" if you are not strictly certain. Stick ONLY to universally known macro-ingredients (e.g. alcohol in vodka, high sugar in chocolate).

Determine if this is actually a legitimate food or beverage item. If it is NOT edible/drinkable, set "is_food" to false and return empty arrays for the rest.
If it is a valid food/beverage item, analyze the precise ingredients to determine:

Respond ONLY with valid JSON in the exact structure below:
{
  "is_food": true,
  "health_score": "1.0", // A score strictly out of 5.0 (e.g. 1.0, 3.5, 4.2). 1.0 is terrible, 5.0 is healthy.
  "health_grade_text": "Very Poor", // E.g., Very Poor, Poor, Fair, Good, Excellent
  "processing_level": "Ultra-Processed", // E.g., Unprocessed, Processed, Ultra-Processed
  "data_accuracy_warning": "Based on generic category estimates", // OR "Based on verified physical label" - depending on if you are guessing.
  "macronutrients": {
     "energy_kcal": "438.0 kcal",
     "total_sugars_g": "35.1 g",
     "added_sugars_g": "28.9 g",
     "sodium_mg": "97.4 mg"
  },
  "concerns": [
    { "title": "Hydrogenated Vegetable Fat", "level": "High Risk", "details": "Raises LDL cholesterol and risk of heart disease." }
  ],
  "positives": [
    { "title": "Trans Fat", "level": "Safe", "details": "not more than 0.04 g" }
  ],
  "alternatives": [
     { "name": "Dark Chocolate (70%+)", "score": "3.8" },
     { "name": "Fresh Fruit", "score": "5.0" }
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Strip markdown formatting if Gemini added it
    const jsonStr = text
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im, "")
      .replace(/```$/m, "")
      .trim();
    
    const parsedData = JSON.parse(jsonStr);
    log.info("Analysis generated successfully", {
      isFood: Boolean(parsedData?.is_food),
      hasConcerns: Array.isArray(parsedData?.concerns) ? parsedData.concerns.length : 0,
      hasPositives: Array.isArray(parsedData?.positives) ? parsedData.positives.length : 0,
    });

    return NextResponse.json(parsedData);
  } catch (error: any) {
    log.error("Unhandled analysis error", {
      message: error?.message || "Unknown error",
      stack: error?.stack || null,
    });
    return NextResponse.json({ error: "Failed to analyze food" }, { status: 500 });
  }
}
