import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: Request) {
  const log = createRequestContext("api/generate-pantry-recipe");
  log.info("Request received");

  try {
    const { items, dietaryPreference } = (await req.json()) as {
      items?: string[];
      dietaryPreference?: string;
    };

    const itemNames = Array.isArray(items) ? items.filter((n) => typeof n === "string" && n.trim()).slice(0, 8) : [];
    if (itemNames.length === 0) {
      return NextResponse.json({ success: false, error: "No pantry items provided" }, { status: 400 });
    }

    if (!genAI) {
      log.error("GEMINI_API_KEY missing");
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    log.info("Payload parsed", { itemCount: itemNames.length });

    const prompt = `You are a creative home cook. Here are near-expiry pantry items:
${itemNames.map((n) => `- ${n}`).join("\n")}

Dietary preference: ${dietaryPreference || "none"}.

Create ONE original recipe that uses as MANY of these items as realistically possible in a single dish — don't force in ones that genuinely don't fit together. You may include a few common pantry staples (salt, oil, water, basic spices) that aren't in the list above, but the near-expiry items above should be the stars of the dish. Respect the dietary preference strictly (e.g. no meat/fish/egg if vegetarian).

Return ONLY this JSON object, no markdown, no explanation:
{
  "title": "Recipe Name",
  "prepTime": "e.g. 25m",
  "usesItems": ["which of the listed items this recipe actually uses"],
  "ingredients": ["ingredient with quantity", "..."],
  "steps": ["step 1", "step 2", "..."]
}`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const jsonStr = text
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im, "")
      .replace(/```$/m, "")
      .trim();

    const parsed = JSON.parse(jsonStr);
    log.info("Recipe generated", { title: parsed?.title, usesItemsCount: Array.isArray(parsed?.usesItems) ? parsed.usesItems.length : 0 });

    const recipe = {
      title: String(parsed?.title || "Pantry Special"),
      prepTime: String(parsed?.prepTime || "20m"),
      usesItems: Array.isArray(parsed?.usesItems) ? parsed.usesItems.map(String) : [],
      ingredients: Array.isArray(parsed?.ingredients) ? parsed.ingredients.map(String) : [],
      steps: Array.isArray(parsed?.steps) ? parsed.steps.map(String) : [],
    };

    return NextResponse.json({ success: true, recipe });
  } catch (error: unknown) {
    log.error("Unhandled pantry recipe error", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ success: false, error: "Failed to generate a recipe" }, { status: 500 });
  }
}
