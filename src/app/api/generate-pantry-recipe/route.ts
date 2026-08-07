import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequestContext } from "@/lib/server-logger";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const isOverloaded = (error: unknown) => {
  const status = (error as { status?: number })?.status;
  return status === 503 || status === 429;
};

/**
 * Gemini intermittently returns 503 "this model is currently experiencing
 * high demand" — hit while testing this very route, which surfaced to the
 * user as a flat "Failed to generate a recipe". Retrying briefly turns
 * most of those into a slight delay instead of a dead end.
 */
async function generateWithRetry(
  model: { generateContent: (p: string) => Promise<{ response: { text: () => string } }> },
  prompt: string,
  attempts = 3
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await model.generateContent(prompt);
    } catch (error) {
      lastError = error;
      if (!isOverloaded(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
    }
  }
  throw lastError;
}

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

    const prompt = `You are an experienced Indian home cook writing everyday ghar ka khana — the kind of food actually cooked in an Indian kitchen on a weeknight, not restaurant or fusion food.

Near-expiry pantry items:
${itemNames.map((n) => `- ${n}`).join("\n")}

Dietary preference: ${dietaryPreference || "none"}.

Create ONE original Indian recipe that uses as MANY of these items as realistically possible in a single dish — don't force in ones that genuinely don't fit together.

Requirements:
- The dish must be genuinely Indian. Use real Indian dish formats: sabzi, dal, curry, sukhi bhaji, pulao, khichdi, poha, upma, chilla, paratha, raita, bhurji, thoran/poriyal, kadhi, or similar. Do NOT return pasta, stir-fry bowls, sandwiches, casseroles, salads or other Western dishes.
- Cook it the Indian way: tadka/tempering where appropriate (jeera, rai, hing, curry leaves), bhuna-ing the masala, and everyday Indian spices (haldi, dhania powder, jeera powder, garam masala, red chilli powder, amchur).
- Use Indian kitchen language and measures naturally (katori, tsp, tbsp, grams, ml) and Indian ingredient names (dhania for coriander leaves, jeera for cumin, etc.) with the English name in brackets the first time if it's not obvious.
- You may include common Indian pantry staples not in the list (oil/ghee, salt, onion, tomato, ginger-garlic, basic spices), but the near-expiry items above should be the stars of the dish.
- Respect the dietary preference strictly. "Veg" means absolutely no meat, fish, or egg. "Eggtarian" allows egg but no meat or fish. This matters a great deal to Indian users — never violate it.

Return ONLY this JSON object, no markdown, no explanation:
{
  "title": "Recipe Name",
  "prepTime": "e.g. 25m",
  "usesItems": ["which of the listed items this recipe actually uses"],
  "ingredients": ["ingredient with quantity", "..."],
  "steps": ["step 1", "step 2", "..."]
}`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await generateWithRetry(model, prompt);
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
    if (isOverloaded(error)) {
      return NextResponse.json(
        { success: false, error: "The recipe service is busy right now. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Failed to generate a recipe" }, { status: 500 });
  }
}
