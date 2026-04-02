import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: Request) {
  try {
    const { name, ingredients, categories } = await req.json();

    if (!genAI) {
      // Fallback if API key is not present
      return NextResponse.json({
        is_food: true,
        health_rating: "Requires API Key",
        coloring_agents: [],
        banned_ingredients: [],
        alternatives: []
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
NOTE: Absolutely ANY item that is edible or consumable by humans (including all sodas, soft drinks, water, juices, condiments, snacks, packaged goods, and liquid drinks) MUST be considered a valid food item ("is_food": true).
If it is a valid food/beverage item, analyze the precise ingredients to determine:
1. Health rating (A short metric like "Poor", "Moderate", "Good")
2. A list of any coloring agents explicitly found (e.g. Red 40, Tartrazine, E150d). Do NOT guess.
3. Any harmful ingredients explicitly found that are historically or currently BANNED in other countries (like the EU, Japan, California) but still used/legal in India. Do NOT guess.
4. Generic healthier alternatives to this type of product.

Respond ONLY with valid JSON in the exact structure below:
{
  "is_food": true,
  "health_rating": "...",
  "coloring_agents": ["agent 1", "agent 2"],
  "banned_ingredients": [
    { "name": "Ingredient Name", "banned_in": "EU/California", "reason": "Why it's bad" }
  ],
  "alternatives": ["Alternative 1", "Alternative 2"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Strip markdown formatting if Gemini added it
    const jsonStr = text.replace(/^```json/m, '').replace(/```$/m, '').trim();
    
    const parsedData = JSON.parse(jsonStr);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Food Analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze food" }, { status: 500 });
  }
}
